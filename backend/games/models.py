from django.db import models
from django.contrib.auth.models import User


class Game(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    steam_appid = models.IntegerField(unique=True)
    header_image = models.URLField(blank=True)
    genres = models.JSONField(default=list)
    tags = models.JSONField(default=list)
    price = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    is_free = models.BooleanField(default=False)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='games')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class Developer(models.Model):
    name = models.CharField(max_length=255)
    game = models.ForeignKey(Game, on_delete=models.CASCADE, related_name='developers')
    website = models.URLField(blank=True)

    def __str__(self):
        return f"{self.name} → {self.game.title}"


class OnlineStats(models.Model):
    game = models.ForeignKey(Game, on_delete=models.CASCADE, related_name='online_stats')
    current_players = models.IntegerField(default=0)
    peak_players = models.IntegerField(default=0)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.game.title} — {self.current_players} players @ {self.timestamp}"


class SteamTopSnapshot(models.Model):
    appid = models.IntegerField(db_index=True)
    current_players = models.IntegerField(default=0)
    peak_players = models.IntegerField(default=0)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['appid', 'timestamp']),
        ]

    def __str__(self):
        return f"Steam {self.appid} — {self.current_players} players @ {self.timestamp}"


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    wishlist = models.ManyToManyField(Game, blank=True, related_name='wishlisted_by')
    steam_id = models.CharField(max_length=64, blank=True)
    avatar_url = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Profile: {self.user.username}"
