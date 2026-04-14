from django.contrib import admin
from .models import Game, Developer, OnlineStats, UserProfile


@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    list_display = ['title', 'steam_appid', 'price', 'is_free', 'created_by', 'created_at']
    search_fields = ['title', 'steam_appid']
    list_filter = ['is_free', 'created_at']


@admin.register(Developer)
class DeveloperAdmin(admin.ModelAdmin):
    list_display = ['name', 'game', 'website']
    search_fields = ['name', 'game__title']


@admin.register(OnlineStats)
class OnlineStatsAdmin(admin.ModelAdmin):
    list_display = ['game', 'current_players', 'peak_players', 'timestamp']
    list_filter = ['game']
    ordering = ['-timestamp']


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'steam_id', 'created_at']
    search_fields = ['user__username']
