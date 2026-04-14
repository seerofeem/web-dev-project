import requests
from django.contrib.auth import authenticate
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token

from .models import Game, Developer, OnlineStats, UserProfile
from .serializers import (
    GameModelSerializer, OnlineStatsModelSerializer,
    OnlineStatsBaseSerializer, DeveloperBaseSerializer,
    UserRegisterSerializer, UserProfileSerializer,
)

STEAM_API_BASE = "https://api.steampowered.com"
STEAM_STORE_BASE = "https://store.steampowered.com/api"


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
        url = f"{STEAM_API_BASE}/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid={appid}"
        r = requests.get(url, timeout=5)
        data = r.json()
        current = data.get('response', {}).get('player_count', 0)

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
        game = self.get_object(pk)
        serializer = GameModelSerializer(game, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        if not request.user.is_authenticated:
            return Response({'detail': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)
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
            url = f"{STEAM_STORE_BASE}/appdetails?appids={appid}&l=english"
            r = requests.get(url, timeout=8)
            data = r.json().get(str(appid), {})
            if not data.get('success'):
                return Response({'error': 'Game not found on Steam.'}, status=404)
            return Response(data.get('data', {}))
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_502_BAD_GATEWAY)

    def post(self, request, appid):
        """Import a Steam game into the local database."""
        if not request.user.is_authenticated:
            return Response({'detail': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            url = f"{STEAM_STORE_BASE}/appdetails?appids={appid}&l=english"
            r = requests.get(url, timeout=8)
            data = r.json().get(str(appid), {}).get('data', {})
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
        return Response({'token': token.key, 'username': user.username}, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    username = request.data.get('username')
    password = request.data.get('password')
    user = authenticate(username=username, password=password)
    if user:
        token, _ = Token.objects.get_or_create(user=user)
        return Response({'token': token.key, 'username': user.username})
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
@permission_classes([AllowAny])
def online_stats_history(request, game_id):
    """Return last 24 hourly snapshots for chart rendering."""
    stats = OnlineStats.objects.filter(game_id=game_id).order_by('-timestamp')[:24]
    serializer = OnlineStatsBaseSerializer(stats, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([AllowAny])
def steam_top_games(request):
    """
    Proxy: Fetch top games by current players from Steam API.
    """
    try:
        url = f"{STEAM_API_BASE}/ISteamChartsService/GetMostPlayedGames/v1/"
        r = requests.get(url, timeout=8)
        rows = r.json().get('response', {}).get('ranks', [])[:20]
        return Response(rows)
    except Exception as e:
        return Response({'error': str(e)}, status=502)
