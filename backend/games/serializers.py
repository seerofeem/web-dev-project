from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Game, Developer, OnlineStats, SteamTopSnapshot, UserProfile


# ── BASE SERIALIZERS (2) ────────────────────────────────────────────────────

class OnlineStatsBaseSerializer(serializers.Serializer):
    """Base Serializer #1 — read-only stats snapshot."""
    game_id = serializers.IntegerField(source='game.id', read_only=True)
    game_title = serializers.CharField(source='game.title', read_only=True)
    current_players = serializers.IntegerField()
    peak_players = serializers.IntegerField()
    timestamp = serializers.DateTimeField(read_only=True)

    def create(self, validated_data):
        raise NotImplementedError("Use OnlineStatsModelSerializer for writes.")

    def update(self, instance, validated_data):
        instance.current_players = validated_data.get('current_players', instance.current_players)
        instance.peak_players = validated_data.get('peak_players', instance.peak_players)
        instance.save()
        return instance


class DeveloperBaseSerializer(serializers.Serializer):
    """Base Serializer #2 — developer info."""
    id = serializers.IntegerField(read_only=True)
    name = serializers.CharField(max_length=255)
    game_id = serializers.IntegerField(write_only=True, required=False)
    website = serializers.URLField(required=False, allow_blank=True)

    def create(self, validated_data):
        return Developer.objects.create(**validated_data)

    def update(self, instance, validated_data):
        instance.name = validated_data.get('name', instance.name)
        instance.website = validated_data.get('website', instance.website)
        instance.save()
        return instance


# ── MODEL SERIALIZERS (2) ───────────────────────────────────────────────────

class GameModelSerializer(serializers.ModelSerializer):
    """ModelSerializer #1 — full Game CRUD."""
    developers = DeveloperBaseSerializer(many=True, read_only=True)
    latest_players = serializers.SerializerMethodField()
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = Game
        fields = [
            'id', 'title', 'description', 'steam_appid', 'header_image',
            'genres', 'tags', 'price', 'is_free',
            'created_by_username', 'created_at', 'updated_at',
            'developers', 'latest_players',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by_username']

    def get_latest_players(self, obj):
        stat = obj.online_stats.first()
        if stat:
            return {'current': stat.current_players, 'peak': stat.peak_players}
        return None


class OnlineStatsModelSerializer(serializers.ModelSerializer):
    """ModelSerializer #2 — OnlineStats with validation."""
    game_title = serializers.CharField(source='game.title', read_only=True)

    class Meta:
        model = OnlineStats
        fields = ['id', 'game', 'game_title', 'current_players', 'peak_players', 'timestamp']
        read_only_fields = ['id', 'timestamp', 'game_title']

    def validate(self, attrs):
        if attrs.get('peak_players', 0) < attrs.get('current_players', 0):
            attrs['peak_players'] = attrs['current_players']
        return attrs


class SteamTopSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = SteamTopSnapshot
        fields = ['appid', 'current_players', 'peak_players', 'timestamp']
        read_only_fields = fields


# ── AUTH SERIALIZERS ────────────────────────────────────────────────────────

class UserRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password2']

    def validate(self, data):
        if data['password'] != data['password2']:
            raise serializers.ValidationError({"password2": "Passwords do not match."})
        return data

    def create(self, validated_data):
        validated_data.pop('password2')
        user = User.objects.create_user(**validated_data)
        UserProfile.objects.create(user=user)
        return user


class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    wishlist = GameModelSerializer(many=True, read_only=True)

    class Meta:
        model = UserProfile
        fields = ['id', 'username', 'email', 'steam_id', 'avatar_url', 'wishlist', 'created_at']
        read_only_fields = ['id', 'created_at']
