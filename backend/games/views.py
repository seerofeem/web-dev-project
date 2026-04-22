from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone as dt_timezone
import re

import requests
from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token

from .models import Game, Developer, OnlineStats, SteamTopSnapshot, UserProfile
from .serializers import (
    GameModelSerializer, OnlineStatsModelSerializer,
    OnlineStatsBaseSerializer, DeveloperBaseSerializer, SteamTopSnapshotSerializer,
    UserRegisterSerializer, UserProfileSerializer,
)

STEAM_API_BASE = "https://api.steampowered.com"
STEAM_STORE_BASE = "https://store.steampowered.com/api"
STEAMCMD_BASE = "https://api.steamcmd.net/v1"
TOP_GAMES_LIMIT = 20
TOP_GAMES_WORKERS = 8
TOP_HISTORY_HOURS = 24
TOP_SNAPSHOT_INTERVAL_MINUTES = 10
TOP_SNAPSHOT_RETENTION_DAYS = 3
STEAM_NEWS_LIMIT = 6
PRICE_REGIONS = [
    ("us", "United States"),
    ("gb", "United Kingdom"),
    ("de", "Germany / EUR"),
    ("kz", "Kazakhstan"),
    ("jp", "Japan"),
    ("br", "Brazil"),
]
ADMIN_REQUIRED_DETAIL = 'Admin privileges required.'
USER_ROLE_ADMIN = 'admin'
USER_ROLE_USER = 'user'


def is_admin_user(user) -> bool:
    return sync_admin_user(user)


def sync_admin_user(user) -> bool:
    if not user or not user.is_authenticated:
        return False

    should_be_admin = bool(
        user.is_superuser
        or user.is_staff
        or user.username.strip().lower() in set(settings.STEAMDB_SYNC_ADMIN_USERNAMES)
    )

    if should_be_admin and not user.is_staff:
        user.is_staff = True
        user.save(update_fields=['is_staff'])

    return should_be_admin


def serialize_auth_response(user, token) -> dict:
    is_admin = sync_admin_user(user)
    return {
        'token': token.key,
        'username': user.username,
        'email': user.email,
        'role': USER_ROLE_ADMIN if is_admin else USER_ROLE_USER,
        'is_admin': is_admin,
    }


def fetch_current_players(appid: int) -> int:
    """Fetch current live players for a single Steam app."""
    url = f"{STEAM_API_BASE}/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid={appid}"
    response = requests.get(url, timeout=5, headers={"User-Agent": "SteamDB Mini/1.0"})
    response.raise_for_status()
    data = response.json()
    return int(data.get('response', {}).get('player_count', 0) or 0)


def fetch_json(url: str, timeout: int = 8) -> dict:
    response = requests.get(
        url,
        timeout=timeout,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; SteamDBMini/1.0)",
            "Accept": "application/json",
        },
    )
    response.raise_for_status()
    return response.json()


def fetch_store_app_details(appid: int, cc: str = "us") -> dict:
    url = f"{STEAM_STORE_BASE}/appdetails?appids={appid}&cc={cc}&l=english"
    payload = fetch_json(url, timeout=8)
    data = payload.get(str(appid), {})
    if not data.get("success"):
        raise ValueError("Game not found on Steam.")
    return data.get("data", {})


def fetch_steamcmd_info(appid: int) -> dict:
    payload = fetch_json(f"{STEAMCMD_BASE}/info/{appid}", timeout=12)
    return payload.get("data", {}).get(str(appid), {})


def fetch_steam_news(appid: int, count: int = STEAM_NEWS_LIMIT):
    payload = fetch_json(
        f"{STEAM_API_BASE}/ISteamNews/GetNewsForApp/v2/?appid={appid}&count={count}&maxlength=400&format=json",
        timeout=8,
    )
    return payload.get("appnews", {}).get("newsitems", [])


def timestamp_to_iso(value):
    if value in (None, "", 0, "0"):
        return None
    try:
        return datetime.fromtimestamp(int(value), tz=dt_timezone.utc).isoformat()
    except (TypeError, ValueError, OSError):
        return None


def clean_text(value, limit: int = 220):
    if not value:
        return ""
    collapsed = re.sub(r"\s+", " ", value).strip()
    if len(collapsed) <= limit:
        return collapsed
    return f"{collapsed[: limit - 1].rstrip()}…"


def normalize_price_region(country_code: str, country_name: str, store_data: dict) -> dict:
    price_data = store_data.get("price_overview") or {}
    is_free = bool(store_data.get("is_free"))
    final_minor = price_data.get("final")
    initial_minor = price_data.get("initial", final_minor)
    return {
        "country_code": country_code.upper(),
        "country_name": country_name,
        "currency": price_data.get("currency", "FREE" if is_free else ""),
        "final_formatted": price_data.get("final_formatted") or ("Free" if is_free else "Unavailable"),
        "initial_formatted": (
            price_data.get("initial_formatted")
            or price_data.get("final_formatted")
            or ("Free" if is_free else "—")
        ),
        "discount_percent": int(price_data.get("discount_percent", 0) or 0),
        "final_minor": int(final_minor) if final_minor not in (None, "") else None,
        "initial_minor": int(initial_minor) if initial_minor not in (None, "") else None,
        "is_free": is_free,
    }


def normalize_package_groups(groups):
    normalized = []
    for group in groups or []:
        subs = []
        for sub in group.get("subs", []) or []:
            subs.append({
                "packageid": int(sub.get("packageid", 0) or 0),
                "option_text": sub.get("option_text", "") or "Unnamed package",
                "option_description": sub.get("option_description", ""),
                "percent_savings": int(sub.get("percent_savings", 0) or 0),
                "price_in_cents_with_discount": int(sub.get("price_in_cents_with_discount", 0) or 0),
                "is_free_license": bool(sub.get("is_free_license")),
            })
        normalized.append({
            "name": group.get("name", ""),
            "title": group.get("title", "") or "Package group",
            "description": group.get("description", ""),
            "selection_text": group.get("selection_text", ""),
            "save_text": group.get("save_text", ""),
            "subs": subs,
        })
    return normalized


def normalize_branches(branches):
    normalized = []
    for name, branch in (branches or {}).items():
        if not isinstance(branch, dict):
            continue
        normalized.append({
            "name": name,
            "buildid": str(branch.get("buildid", "") or ""),
            "description": branch.get("description", "") or "",
            "updated_at": timestamp_to_iso(branch.get("timeupdated")),
            "built_at": timestamp_to_iso(branch.get("timebuildupdated")),
            "_sort": int(branch.get("timeupdated", 0) or branch.get("timebuildupdated", 0) or 0),
        })
    return [
        {key: value for key, value in branch.items() if key != "_sort"}
        for branch in sorted(normalized, key=lambda item: item["_sort"], reverse=True)[:12]
    ]


def normalize_depots(depots_root):
    depots = []
    for depot_id, depot in (depots_root or {}).items():
        if not str(depot_id).isdigit() or not isinstance(depot, dict):
            continue
        manifests = depot.get("manifests", {}) if isinstance(depot.get("manifests"), dict) else {}
        public_manifest = manifests.get("public", {}) if isinstance(manifests.get("public"), dict) else {}
        config = depot.get("config", {}) if isinstance(depot.get("config"), dict) else {}
        depots.append({
            "depot_id": int(depot_id),
            "oslist": config.get("oslist", ""),
            "osarch": config.get("osarch", ""),
            "dlcappid": int(depot.get("dlcappid", 0) or 0) or None,
            "sharedinstall": str(depot.get("sharedinstall", "0")) == "1",
            "manifest_count": len(manifests),
            "public_gid": str(public_manifest.get("gid", "") or ""),
            "public_size": int(public_manifest.get("size", 0) or 0),
            "public_download": int(public_manifest.get("download", 0) or 0),
        })
    return sorted(depots, key=lambda depot: depot["public_size"], reverse=True)[:12]


def normalize_launch_configs(config):
    launch_map = config.get("launch", {}) if isinstance(config.get("launch"), dict) else {}
    launch_rows = []
    for index, row in launch_map.items():
        if not isinstance(row, dict):
            continue
        row_config = row.get("config", {}) if isinstance(row.get("config"), dict) else {}
        launch_rows.append({
            "index": str(index),
            "executable": row.get("executable", ""),
            "arguments": row.get("arguments", ""),
            "description": row.get("description", "") or "Default launch",
            "oslist": row_config.get("oslist", ""),
            "osarch": row_config.get("osarch", ""),
            "betakey": row_config.get("betakey", ""),
            "ownsdlc": row_config.get("ownsdlc", ""),
            "type": row.get("type", ""),
        })
    return launch_rows[:10]


def normalize_config_entries(config):
    desired_keys = [
        "installdir",
        "contenttype",
        "checkforupdatesbeforelaunch",
        "matchmaking_uptodate",
        "launchwithoutworkshopupdates",
        "steamcontrollertemplateindex",
        "vacmodulefilename",
        "uselaunchcommandline",
        "usemms",
        "sdr-groups",
    ]
    entries = []
    for key in desired_keys:
        value = config.get(key)
        if value in (None, "", {}, []):
            continue
        entries.append({"key": key, "value": str(value)})
    return entries


def normalize_news_feed(items):
    normalized = []
    for item in items or []:
        normalized.append({
            "gid": str(item.get("gid", "")),
            "title": item.get("title", "") or "Steam update",
            "url": item.get("url", ""),
            "author": item.get("author", "") or "Steam",
            "feedlabel": item.get("feedlabel", "") or "Steam News",
            "feedname": item.get("feedname", ""),
            "date": timestamp_to_iso(item.get("date")),
            "contents": clean_text(item.get("contents", "")),
            "tags": item.get("tags", []) or [],
        })
    return normalized


def persist_top_snapshot(appid: int, current: int, peak: int) -> None:
    latest = SteamTopSnapshot.objects.filter(appid=appid).first()
    now = timezone.now()
    if latest and now - latest.timestamp < timedelta(minutes=TOP_SNAPSHOT_INTERVAL_MINUTES):
        return
    SteamTopSnapshot.objects.create(appid=appid, current_players=current, peak_players=max(peak, current))


# ══════════════════════════════════════════════════════════════════
# FUNCTION-BASED VIEWS (2)
# ══════════════════════════════════════════════════════════════════

@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def game_list_create(request):
    """
    FBV #1 — GET: list all games | POST: create a game (auth required).
    """
    if request.method == 'GET':
        games = Game.objects.prefetch_related('developers', 'online_stats').all()
        serializer = GameModelSerializer(games, many=True)
        return Response(serializer.data)

    # POST — requires authentication
    if not request.user.is_authenticated:
        return Response({'detail': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)
    if not is_admin_user(request.user):
        return Response({'detail': ADMIN_REQUIRED_DETAIL}, status=status.HTTP_403_FORBIDDEN)

    serializer = GameModelSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(created_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([AllowAny])
def steam_online_stats(request, appid):
    """
    FBV #2 — Proxy to Steam API: fetch live player count for a game.
    Also persists snapshot to OnlineStats model.
    """
    try:
        current = fetch_current_players(appid)

        # Persist snapshot if game exists in DB
        game = Game.objects.filter(steam_appid=appid).first()
        peak = current
        if game:
            last = game.online_stats.first()
            if last:
                peak = max(last.peak_players, current)
            OnlineStats.objects.create(game=game, current_players=current, peak_players=peak)

        return Response({'appid': appid, 'current_players': current, 'peak_players': peak})
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_502_BAD_GATEWAY)


# ══════════════════════════════════════════════════════════════════
# CLASS-BASED VIEWS (2)
# ══════════════════════════════════════════════════════════════════

class GameDetailView(APIView):
    """
    CBV #1 — GET / PUT / DELETE for a single Game.
    """
    permission_classes = [AllowAny]

    def get_object(self, pk):
        return get_object_or_404(Game, pk=pk)

    def get(self, request, pk):
        game = self.get_object(pk)
        serializer = GameModelSerializer(game)
        return Response(serializer.data)

    def put(self, request, pk):
        if not request.user.is_authenticated:
            return Response({'detail': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)
        if not is_admin_user(request.user):
            return Response({'detail': ADMIN_REQUIRED_DETAIL}, status=status.HTTP_403_FORBIDDEN)
        game = self.get_object(pk)
        serializer = GameModelSerializer(game, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        if not request.user.is_authenticated:
            return Response({'detail': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)
        if not is_admin_user(request.user):
            return Response({'detail': ADMIN_REQUIRED_DETAIL}, status=status.HTTP_403_FORBIDDEN)
        game = self.get_object(pk)
        game.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SteamGameInfoView(APIView):
    """
    CBV #2 — Fetch game metadata from Steam Store API and optionally save to DB.
    GET  /api/steam/appinfo/<appid>/        → returns store details
    POST /api/steam/appinfo/<appid>/import/ → imports game into local DB
    """
    permission_classes = [AllowAny]

    def get(self, request, appid):
        try:
            return Response(fetch_store_app_details(appid, "us"))
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_502_BAD_GATEWAY)

    def post(self, request, appid):
        """Import a Steam game into the local database."""
        if not request.user.is_authenticated:
            return Response({'detail': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)
        if not is_admin_user(request.user):
            return Response({'detail': ADMIN_REQUIRED_DETAIL}, status=status.HTTP_403_FORBIDDEN)
        try:
            data = fetch_store_app_details(appid, "us")
            if not data:
                return Response({'error': 'Game not found on Steam.'}, status=404)

            price_obj = data.get('price_overview', {})
            price = price_obj.get('final', 0) / 100 if price_obj else 0

            game, created = Game.objects.update_or_create(
                steam_appid=appid,
                defaults={
                    'title': data.get('name', ''),
                    'description': data.get('short_description', ''),
                    'header_image': data.get('header_image', ''),
                    'genres': [g['description'] for g in data.get('genres', [])],
                    'tags': [t['description'] for t in data.get('categories', [])],
                    'price': price,
                    'is_free': data.get('is_free', False),
                    'created_by': request.user,
                }
            )

            # Save developers
            for dev_name in data.get('developers', []):
                Developer.objects.get_or_create(game=game, name=dev_name)

            serializer = GameModelSerializer(game)
            return Response(
                {'created': created, 'game': serializer.data},
                status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
            )
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_502_BAD_GATEWAY)


# ══════════════════════════════════════════════════════════════════
# AUTH VIEWS
# ══════════════════════════════════════════════════════════════════

@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    serializer = UserRegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        return Response(serialize_auth_response(user, token), status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    username = request.data.get('username')
    password = request.data.get('password')
    user = authenticate(username=username, password=password)
    if user:
        token, _ = Token.objects.get_or_create(user=user)
        return Response(serialize_auth_response(user, token))
    return Response({'detail': 'Invalid credentials.'}, status=status.HTTP_401_UNAUTHORIZED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    request.user.auth_token.delete()
    return Response({'detail': 'Logged out.'})


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def my_profile(request):
    profile, _ = UserProfile.objects.get_or_create(user=request.user)
    sync_admin_user(request.user)
    if request.method == 'GET':
        return Response(UserProfileSerializer(profile).data)
    serializer = UserProfileSerializer(profile, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=400)


@api_view(['POST', 'DELETE'])
@permission_classes([IsAuthenticated])
def wishlist_toggle(request, game_id):
    profile, _ = UserProfile.objects.get_or_create(user=request.user)
    game = get_object_or_404(Game, pk=game_id)
    if request.method == 'POST':
        profile.wishlist.add(game)
        return Response({'detail': f'{game.title} added to wishlist.'})
    profile.wishlist.remove(game)
    return Response({'detail': f'{game.title} removed from wishlist.'})


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_overview(request):
    recent_users = list(User.objects.order_by('-date_joined')[:8])
    profiles_by_user_id = {
        profile.user_id: profile
        for profile in UserProfile.objects.filter(user__in=recent_users)
    }

    return Response({
        'counts': {
            'users_total': User.objects.count(),
            'admins_total': User.objects.filter(is_staff=True).count(),
            'games_total': Game.objects.count(),
            'wishlist_items_total': UserProfile.wishlist.through.objects.count(),
            'active_sessions_total': Token.objects.count(),
        },
        'recent_users': [
            {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'role': USER_ROLE_ADMIN if is_admin_user(user) else USER_ROLE_USER,
                'is_admin': is_admin_user(user),
                'date_joined': user.date_joined,
                'last_login': user.last_login,
                'avatar_url': profiles_by_user_id.get(user.id).avatar_url if profiles_by_user_id.get(user.id) else '',
                'steam_id': profiles_by_user_id.get(user.id).steam_id if profiles_by_user_id.get(user.id) else '',
            }
            for user in recent_users
        ],
    })

@api_view(['GET'])
@permission_classes([AllowAny])
def steam_top_news(request):
    try:
        url = f"{STEAM_API_BASE}/ISteamChartsService/GetMostPlayedGames/v1/"
        response = requests.get(url, timeout=8)
        response.raise_for_status()
        rows = response.json().get('response', {}).get('ranks', [])[:10]
        
        all_news = []
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = {
                executor.submit(fetch_steam_news, int(row['appid']), 3): int(row['appid'])
                for row in rows if row.get('appid')
            }
            for future in as_completed(futures):
                appid = futures[future]
                try:
                    items = future.result()
                    for item in items:
                        all_news.append({
                            'appid': appid,
                            'gid': str(item.get('gid', '')),
                            'title': item.get('title', ''),
                            'url': item.get('url', ''),
                            'author': item.get('author', '') or 'Steam',
                            'feedlabel': item.get('feedlabel', ''),
                            'date': timestamp_to_iso(item.get('date')),
                            'contents': clean_text(item.get('contents', ''), 200),
                        })
                except Exception:
                    continue
        
        all_news.sort(key=lambda x: x['date'] or '', reverse=True)
        return Response(all_news[:50])
    except Exception as e:
        return Response({'error': str(e)}, status=502)
@api_view(['GET'])
@permission_classes([AllowAny])
def online_stats_history(request, game_id):
    """Return last 24 hourly snapshots for chart rendering."""
    stats = OnlineStats.objects.filter(game_id=game_id).order_by('-timestamp')[:24]
    serializer = OnlineStatsBaseSerializer(stats, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([AllowAny])
def steam_top_history(request, appid):
    """Return recent daily snapshots for a Steam top-game app id."""
    since = timezone.now() - timedelta(hours=TOP_HISTORY_HOURS)
    snapshots = SteamTopSnapshot.objects.filter(appid=appid, timestamp__gte=since).order_by('timestamp')
    serializer = SteamTopSnapshotSerializer(snapshots, many=True)
    return Response(serializer.data)
@api_view(['GET'])
@permission_classes([AllowAny])
def steam_top_games_extended(request):
    try:
        limit = int(request.query_params.get('limit', 20))
        limit = min(limit, 100)
        url = f"{STEAM_API_BASE}/ISteamChartsService/GetMostPlayedGames/v1/"
        response = requests.get(url, timeout=8)
        response.raise_for_status()
        rows = response.json().get('response', {}).get('ranks', [])[:limit]
        return Response([{
            'appid': int(row.get('appid', 0)),
            'rank': int(row.get('rank', 0)),
            'concurrent_in_game': int(row.get('concurrent_in_game', 0)),
            'peak_in_game': int(row.get('peak_in_game', 0)),
        } for row in rows])
    except Exception as e:
        return Response({'error': str(e)}, status=502)
@api_view(['GET'])
@permission_classes([AllowAny])
def steam_upcoming_games(request):
    try:
        url = "https://store.steampowered.com/api/featuredcategories/?cc=us&l=english"
        response = requests.get(url, timeout=10, headers={
            "User-Agent": "Mozilla/5.0 (compatible; SteamDBMini/1.0)"
        })
        response.raise_for_status()
        data = response.json()
        items = data.get('coming_soon', {}).get('items', [])
        results = []
        for item in items:
            aid = item.get('id') or item.get('appid') or 0
            if not aid:
                continue
            price = item.get('final_price', 0)
            release = item.get('release_date') or '—'
            results.append({
                'appid': aid,
                'name': item.get('name', f'App {aid}'),
                'header_image': f"https://cdn.akamai.steamstatic.com/steam/apps/{aid}/header.jpg",
                'release_date': release,
                'final_price': price,
                'is_free': item.get('is_free_game', False) or price == 0,
            })
        return Response(results)
    except Exception as e:
        return Response({'error': str(e)}, status=502)
@api_view(['GET'])
@permission_classes([AllowAny])
def steam_top_games(request):
    """
    Proxy: fetch Steam top games and enrich rows with current live players.
    """
    try:
        url = f"{STEAM_API_BASE}/ISteamChartsService/GetMostPlayedGames/v1/"
        response = requests.get(url, timeout=8)
        response.raise_for_status()
        rows = response.json().get('response', {}).get('ranks', [])[:TOP_GAMES_LIMIT]

        current_by_appid = {}
        with ThreadPoolExecutor(max_workers=TOP_GAMES_WORKERS) as executor:
            futures = {
                executor.submit(fetch_current_players, int(row.get('appid', 0))): int(row.get('appid', 0))
                for row in rows if row.get('appid')
            }
            for future in as_completed(futures):
                appid = futures[future]
                try:
                    current_by_appid[appid] = future.result()
                except Exception:
                    current_by_appid[appid] = 0

        enriched_rows = []
        for row in rows:
            appid = int(row.get('appid', 0) or 0)
            peak = int(row.get('peak_in_game', 0) or 0)
            current = int(current_by_appid.get(appid, 0))
            persist_top_snapshot(appid, current, peak)
            enriched = {
                **row,
                'appid': appid,
                'rank': int(row.get('rank', 0) or 0),
                'peak_in_game': peak,
                'concurrent_in_game': current,
            }
            enriched_rows.append(enriched)
        SteamTopSnapshot.objects.filter(
            timestamp__lt=timezone.now() - timedelta(days=TOP_SNAPSHOT_RETENTION_DAYS)
        ).delete()
        return Response(enriched_rows)
    except Exception as e:
        return Response({'error': str(e)}, status=502)


@api_view(['GET'])
@permission_classes([AllowAny])
def steam_app_deep_detail(request, appid):
    """
    SteamDB-like aggregate payload for one app:
    store pricing, changenumber, branches, depots, launch configs, and patch feed.
    """
    try:
        store_by_region = {}
        with ThreadPoolExecutor(max_workers=len(PRICE_REGIONS)) as executor:
            futures = {
                executor.submit(fetch_store_app_details, appid, code): (code, label)
                for code, label in PRICE_REGIONS
            }
            for future in as_completed(futures):
                code, _label = futures[future]
                try:
                    store_by_region[code] = future.result()
                except Exception:
                    continue

        if not store_by_region:
            return Response({'error': 'Game not found on Steam.'}, status=404)

        primary_store = store_by_region.get("us") or next(iter(store_by_region.values()))
        steamcmd_info = fetch_steamcmd_info(appid)
        if not steamcmd_info:
            raise ValueError("Steam app metadata is unavailable right now.")

        news_feed = normalize_news_feed(fetch_steam_news(appid))
        common = steamcmd_info.get("common", {}) if isinstance(steamcmd_info.get("common"), dict) else {}
        config = steamcmd_info.get("config", {}) if isinstance(steamcmd_info.get("config"), dict) else {}
        extended = steamcmd_info.get("extended", {}) if isinstance(steamcmd_info.get("extended"), dict) else {}
        depots_root = steamcmd_info.get("depots", {}) if isinstance(steamcmd_info.get("depots"), dict) else {}
        branches = normalize_branches(depots_root.get("branches", {}))
        pricing = [
            normalize_price_region(code, label, store_by_region[code])
            for code, label in PRICE_REGIONS
            if code in store_by_region
        ]

        return Response({
            "appid": appid,
            "fetched_at": timezone.now().isoformat(),
            "store_type": primary_store.get("type") or common.get("type") or "game",
            "website": primary_store.get("website") or extended.get("homepage") or "",
            "recommendation_total": int((primary_store.get("recommendations") or {}).get("total", 0) or 0),
            "screenshot_count": len(primary_store.get("screenshots", []) or []),
            "movie_count": len(primary_store.get("movies", []) or []),
            "dlc_count": len(primary_store.get("dlc", []) or []),
            "content_notes": ((primary_store.get("content_descriptors") or {}).get("notes") or ""),
            "review_score": common.get("review_score", ""),
            "review_percentage": common.get("review_percentage", ""),
            "changenumber": int(steamcmd_info.get("_change_number", 0) or 0) or None,
            "sha": steamcmd_info.get("_sha", ""),
            "payload_size": int(steamcmd_info.get("_size", 0) or 0) or None,
            "build_id": branches[0].get("buildid") if branches else "",
            "store_last_updated_at": timestamp_to_iso(common.get("store_asset_mtime")),
            "steam_release_at": timestamp_to_iso(common.get("steam_release_date")),
            "platforms": [name for name, enabled in (primary_store.get("platforms") or {}).items() if enabled],
            "categories": [row.get("description", "") for row in (primary_store.get("categories") or []) if row.get("description")],
            "supported_languages": sorted((common.get("languages") or {}).keys()),
            "package_ids": [int(package_id) for package_id in (primary_store.get("packages") or []) if package_id],
            "pricing": pricing,
            "package_groups": normalize_package_groups(primary_store.get("package_groups") or []),
            "depots": normalize_depots(depots_root),
            "branches": branches,
            "launch_configs": normalize_launch_configs(config),
            "config_entries": normalize_config_entries(config),
            "news_feed": news_feed,
        })
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_502_BAD_GATEWAY)
