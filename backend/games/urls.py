from django.urls import path
from . import views

urlpatterns = [
    # ── Games CRUD ─────────────────────────────────────────────────
    path('games/', views.game_list_create, name='game-list-create'),          # FBV #1
    path('games/<int:pk>/', views.GameDetailView.as_view(), name='game-detail'),  # CBV #1
    path('steam/upcoming/', views.steam_upcoming_games, name='steam-upcoming'),
    # ── Steam API Proxy ────────────────────────────────────────────
    path('steam/players/<int:appid>/', views.steam_online_stats, name='steam-players'),  # FBV #2
    path('steam/appinfo/<int:appid>/', views.SteamGameInfoView.as_view(), name='steam-appinfo'),  # CBV #2
    path('steam/deep/<int:appid>/', views.steam_app_deep_detail, name='steam-app-deep-detail'),
    path('steam/top/', views.steam_top_games, name='steam-top'),
    path('steam/history/<int:appid>/', views.steam_top_history, name='steam-top-history'),

    # ── Stats History (for charts) ─────────────────────────────────
    path('games/<int:game_id>/stats/', views.online_stats_history, name='stats-history'),

    # ── Auth ───────────────────────────────────────────────────────
    path('auth/register/', views.register, name='register'),
    path('auth/login/', views.login_view, name='login'),
    path('auth/logout/', views.logout_view, name='logout'),

    # ── Profile & Wishlist ─────────────────────────────────────────
    path('profile/', views.my_profile, name='my-profile'),
    path('profile/wishlist/<int:game_id>/', views.wishlist_toggle, name='wishlist-toggle'),
    path('admin/overview/', views.admin_overview, name='admin-overview'),
]
