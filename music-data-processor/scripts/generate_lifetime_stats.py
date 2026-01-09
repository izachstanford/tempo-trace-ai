#!/usr/bin/env python3
"""
Lifetime Streaming Stats Generator

This script processes consolidated streaming data and generates comprehensive
lifetime statistics for a web insights dashboard.

Usage: python generate_lifetime_stats.py
"""

import json
import sys
from pathlib import Path
from typing import List, Dict, Any, Set, Tuple
from datetime import datetime, timedelta
from collections import defaultdict, Counter
import re


# Years to exclude entirely from stats (incomplete years)
EXCLUDED_YEARS = {2026}


def parse_timestamp(ts_str: str) -> datetime:
    """Parse timestamp string to datetime object."""
    try:
        if ts_str.endswith('Z'):
            if '.' in ts_str:
                return datetime.strptime(ts_str, '%Y-%m-%dT%H:%M:%S.%fZ')
            else:
                return datetime.strptime(ts_str, '%Y-%m-%dT%H:%M:%SZ')
        else:
            return datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
    except Exception:
        return datetime.min


def get_time_period(dt: datetime) -> Dict[str, Any]:
    """Extract various time period information from datetime."""
    return {
        'year': dt.year,
        'month': dt.month,
        'day': dt.day,
        'hour': dt.hour,
        'weekday': dt.weekday(),  # 0=Monday, 6=Sunday
        'quarter': ((dt.month - 1) // 3) + 1,
        'day_of_year': dt.timetuple().tm_yday,
        'week_of_year': dt.isocalendar()[1],
        'month_name': dt.strftime('%B'),
        'weekday_name': dt.strftime('%A'),
        'season': get_season(dt.month)
    }


def get_season(month: int) -> str:
    """Get season from month number."""
    if month in [12, 1, 2]:
        return 'Winter'
    elif month in [3, 4, 5]:
        return 'Spring'
    elif month in [6, 7, 8]:
        return 'Summer'
    else:
        return 'Fall'


def clean_platform_name(platform: str) -> str:
    """Clean and normalize platform names."""
    if not platform:
        return 'Unknown'
    
    platform = platform.lower()
    
    # Map to clean categories
    if 'ios' in platform or 'iphone' in platform or 'ipad' in platform:
        return 'iOS'
    elif 'android' in platform:
        return 'Android'
    elif 'osx' in platform or 'macos' in platform or 'macintosh' in platform:
        return 'macOS'
    elif 'windows' in platform:
        return 'Windows'
    elif 'web' in platform or 'websocket' in platform:
        return 'Web Player'
    elif 'watch' in platform:
        return 'Watch'
    elif 'garmin' in platform:
        return 'Garmin'
    elif 'google' in platform or 'cast' in platform:
        return 'Google Cast'
    elif 'partner' in platform:
        return 'Partner Device'
    else:
        return 'Other'


def extract_listening_patterns(records: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Extract listening patterns and behaviors."""
    patterns = {
        'skip_rate': 0.0,
        'completion_rate': 0.0,
        'average_session_length': 0.0,
        'peak_listening_hours': [],
        'peak_listening_days': [],
        'listening_streaks': {},
        'binge_sessions': [],
        'discovery_rate': 0.0
    }
    
    if not records:
        return patterns
    
    # Calculate skip and completion rates
    total_plays = len(records)
    skipped_plays = sum(1 for r in records if r.get('skipped', False))
    completed_plays = sum(1 for r in records if r.get('reason_end') == 'trackdone')
    
    patterns['skip_rate'] = (skipped_plays / total_plays) * 100 if total_plays > 0 else 0
    patterns['completion_rate'] = (completed_plays / total_plays) * 100 if total_plays > 0 else 0
    
    # Analyze listening by hour and day
    hour_counts = defaultdict(int)
    day_counts = defaultdict(int)
    
    for record in records:
        dt = parse_timestamp(record.get('ts', ''))
        if dt != datetime.min:
            hour_counts[dt.hour] += 1
            day_counts[dt.strftime('%A')] += 1
    
    # Get peak hours and days
    patterns['peak_listening_hours'] = sorted(hour_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    patterns['peak_listening_days'] = sorted(day_counts.items(), key=lambda x: x[1], reverse=True)
    
    # Calculate average session length (simplified)
    total_ms = sum(record.get('ms_played', 0) for record in records)
    patterns['average_session_length'] = total_ms / total_plays if total_plays > 0 else 0
    
    return patterns


def calculate_diversity_metrics(records: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calculate music diversity and discovery metrics."""
    artists = set()
    tracks = set()
    track_artists = set()
    artist_play_counts = defaultdict(int)
    
    for record in records:
        artist = record.get('master_metadata_album_artist_name')
        track = record.get('master_metadata_track_name')
        
        if artist:
            artists.add(artist)
            artist_play_counts[artist] += 1
        if track:
            tracks.add(track)
            # Also track track+artist combinations
            if artist:
                track_artists.add(f"{track}|{artist}")
    
    # Calculate diversity metrics
    total_plays = len(records)
    unique_artists = len(artists)
    unique_tracks = len(tracks)
    unique_track_artists = len(track_artists)
    
    # Artist diversity (higher = more diverse)
    artist_diversity = unique_artists / total_plays if total_plays > 0 else 0
    
    # Calculate concentration (what % of plays are from top artists)
    sorted_artists = sorted(artist_play_counts.items(), key=lambda x: x[1], reverse=True)
    top_1_percent = sorted_artists[0][1] / total_plays * 100 if sorted_artists else 0
    top_5_percent = sum(count for _, count in sorted_artists[:5]) / total_plays * 100 if len(sorted_artists) >= 5 else 0
    top_10_percent = sum(count for _, count in sorted_artists[:10]) / total_plays * 100 if len(sorted_artists) >= 10 else 0
    
    return {
        'artist_diversity_score': artist_diversity,
        'unique_artists': unique_artists,
        'unique_tracks': unique_tracks,  # Legacy: track names only
        'unique_track_artists': unique_track_artists,  # New: track+artist combinations
        'top_1_artist_concentration': top_1_percent,
        'top_5_artist_concentration': top_5_percent,
        'top_10_artist_concentration': top_10_percent,
        'plays_per_artist': total_plays / unique_artists if unique_artists > 0 else 0,
        'plays_per_track': total_plays / unique_tracks if unique_tracks > 0 else 0,
        'plays_per_track_artist': total_plays / unique_track_artists if unique_track_artists > 0 else 0
    }


def generate_lifetime_stats(consolidated_file: str) -> Dict[str, Any]:
    """Generate comprehensive lifetime streaming statistics."""
    print("Loading consolidated streaming data...")
    
    try:
        with open(consolidated_file, 'r', encoding='utf-8') as file:
            records = json.load(file)
    except Exception as e:
        print(f"Error loading file: {e}")
        return {}
    
    # Filter out excluded years
    original_count = len(records)
    records = [r for r in records if parse_timestamp(r.get('ts', '')).year not in EXCLUDED_YEARS]
    if original_count != len(records):
        print(f"Filtered out {original_count - len(records)} records from excluded years: {EXCLUDED_YEARS}")
    
    print(f"Processing {len(records)} records...")
    
    # Initialize stats structure
    stats = {
        'metadata': {
            'generated_at': datetime.now().isoformat(),
            'total_records': len(records),
            'data_sources': ['Spotify', 'Apple Music']
        },
        'time_stats': {},
        'content_stats': {},
        'platform_stats': {},
        'provider_stats': {},
        'temporal_patterns': {},
        'listening_behavior': {},
        'diversity_metrics': {},
        'top_lists': {},
        'milestones': {},
        'geographical_stats': {},
        'technical_stats': {}
    }
    
    if not records:
        return stats
    
    # Basic counters and accumulators
    total_ms = 0
    providers = defaultdict(int)
    platforms = defaultdict(int)
    countries = defaultdict(int)
    artists = defaultdict(int)
    artists_minutes = defaultdict(float)  # minutes streamed per artist
    tracks = defaultdict(int)  # track name only (for backward compatibility)
    tracks_minutes = defaultdict(float)  # minutes streamed per track
    track_artists = defaultdict(int)  # track+artist combinations
    track_artists_minutes = defaultdict(float)  # minutes streamed per track+artist
    albums = defaultdict(int)
    albums_minutes = defaultdict(float)  # minutes streamed per album
    
    # Time-based analysis
    yearly_stats = defaultdict(lambda: {'plays': 0, 'ms_played': 0})
    monthly_stats = defaultdict(lambda: {'plays': 0, 'ms_played': 0})
    daily_stats = defaultdict(lambda: {'plays': 0, 'ms_played': 0})
    hourly_stats = defaultdict(lambda: {'plays': 0, 'ms_played': 0})
    weekday_stats = defaultdict(lambda: {'plays': 0, 'ms_played': 0})
    seasonal_stats = defaultdict(lambda: {'plays': 0, 'ms_played': 0})
    
    # Behavioral analysis
    skip_count = 0
    completion_count = 0
    offline_count = 0
    shuffle_count = 0
    
    # Date tracking
    earliest_date = None
    latest_date = None
    
    # Years to exclude from album stats (90%+ Apple Music)
    EXCLUDED_ALBUM_YEARS = {2016, 2017, 2020, 2021}
    
    # Process each record
    for record in records:
        # Basic metrics
        ms_played = record.get('ms_played', 0)
        total_ms += ms_played
        
        # Content tracking
        provider = record.get('provider', 'Unknown')
        platform = clean_platform_name(record.get('platform', 'Unknown'))
        country = record.get('conn_country', 'Unknown')
        artist = record.get('master_metadata_album_artist_name', 'Unknown')
        track = record.get('master_metadata_track_name', 'Unknown')
        album = record.get('master_metadata_album_album_name', 'Unknown')
        
        providers[provider] += 1
        platforms[platform] += 1
        countries[country] += 1
        
        if artist and artist != 'Unknown':
            artists[artist] += 1
            artists_minutes[artist] += ms_played / 1000 / 60  # Convert ms to minutes
        if track and track != 'Unknown':
            tracks[track] += 1
            tracks_minutes[track] += ms_played / 1000 / 60
            # Also track track+artist combinations
            if artist and artist != 'Unknown':
                track_artist_key = f"{track}|{artist}"
                track_artists[track_artist_key] += 1
                track_artists_minutes[track_artist_key] += ms_played / 1000 / 60
        
        # Only track albums from Spotify (Apple Music has no album data)
        # Also exclude years that are 90%+ Apple Music
        if album and album != 'Unknown' and provider == 'Spotify':
            # Check the year for this record
            year = None
            ts_check = record.get('ts')
            if ts_check:
                dt_check = parse_timestamp(ts_check)
                if dt_check != datetime.min:
                    year = dt_check.year
            
            if year is None or year not in EXCLUDED_ALBUM_YEARS:
                albums[album] += 1
                albums_minutes[album] += ms_played / 1000 / 60
        
        # Behavioral tracking
        if record.get('skipped', False):
            skip_count += 1
        if record.get('reason_end') == 'trackdone':
            completion_count += 1
        if record.get('offline', False):
            offline_count += 1
        if record.get('shuffle', False):
            shuffle_count += 1
        
        # Time-based analysis
        ts = record.get('ts')
        if ts:
            dt = parse_timestamp(ts)
            if dt != datetime.min:
                if earliest_date is None or dt < earliest_date:
                    earliest_date = dt
                if latest_date is None or dt > latest_date:
                    latest_date = dt
                
                time_info = get_time_period(dt)
                
                yearly_stats[time_info['year']]['plays'] += 1
                yearly_stats[time_info['year']]['ms_played'] += ms_played
                
                monthly_stats[f"{time_info['year']}-{time_info['month']:02d}"]['plays'] += 1
                monthly_stats[f"{time_info['year']}-{time_info['month']:02d}"]['ms_played'] += ms_played
                
                daily_stats[dt.date().isoformat()]['plays'] += 1
                daily_stats[dt.date().isoformat()]['ms_played'] += ms_played
                
                hourly_stats[time_info['hour']]['plays'] += 1
                hourly_stats[time_info['hour']]['ms_played'] += ms_played
                
                weekday_stats[time_info['weekday_name']]['plays'] += 1
                weekday_stats[time_info['weekday_name']]['ms_played'] += ms_played
                
                seasonal_stats[time_info['season']]['plays'] += 1
                seasonal_stats[time_info['season']]['ms_played'] += ms_played
    
    # Calculate derived metrics
    total_records = len(records)
    
    # Time statistics
    total_seconds = total_ms / 1000
    total_minutes = total_seconds / 60
    total_hours = total_minutes / 60
    total_days = total_hours / 24
    total_weeks = total_days / 7
    total_months = total_days / 30.44  # Average month length
    total_years = total_days / 365.25  # Average year length
    
    stats['time_stats'] = {
        'total_milliseconds': total_ms,
        'total_seconds': total_seconds,
        'total_minutes': total_minutes,
        'total_hours': total_hours,
        'total_days': total_days,
        'total_weeks': total_weeks,
        'total_months': total_months,
        'total_years': total_years,
        'average_track_length_ms': total_ms / total_records if total_records > 0 else 0,
        'average_track_length_seconds': total_seconds / total_records if total_records > 0 else 0,
        'average_track_length_minutes': total_minutes / total_records if total_records > 0 else 0,
        'earliest_play': earliest_date.isoformat() if earliest_date else None,
        'latest_play': latest_date.isoformat() if latest_date else None,
        'tracking_span_days': (latest_date - earliest_date).days if earliest_date and latest_date else 0
    }
    
    # Content statistics
    stats['content_stats'] = {
        'unique_artists': len(artists),
        'unique_tracks': len(tracks),  # Legacy: track names only
        'unique_track_artists': len(track_artists),  # New: track+artist combinations
        'unique_albums': len(albums),
        'total_plays': total_records,
        'average_plays_per_artist': total_records / len(artists) if artists else 0,
        'average_plays_per_track': total_records / len(tracks) if tracks else 0,
        'average_plays_per_track_artist': total_records / len(track_artists) if track_artists else 0,
        'average_plays_per_album': total_records / len(albums) if albums else 0
    }
    
    # Platform and provider statistics
    stats['platform_stats'] = {
        'distribution': dict(platforms),
        'total_platforms': len(platforms),
        'top_platform': max(platforms.items(), key=lambda x: x[1])[0] if platforms else None
    }
    
    stats['provider_stats'] = {
        'distribution': dict(providers),
        'total_providers': len(providers),
        'spotify_percentage': (providers['Spotify'] / total_records * 100) if total_records > 0 else 0,
        'apple_music_percentage': (providers['Apple Music'] / total_records * 100) if total_records > 0 else 0
    }
    
    # Geographical statistics
    stats['geographical_stats'] = {
        'countries_streamed_from': len(countries),
        'top_countries': sorted(countries.items(), key=lambda x: x[1], reverse=True)[:10],
        'distribution': dict(countries)
    }
    
    # Behavioral statistics
    stats['listening_behavior'] = {
        'skip_rate_percentage': (skip_count / total_records * 100) if total_records > 0 else 0,
        'completion_rate_percentage': (completion_count / total_records * 100) if total_records > 0 else 0,
        'offline_listening_percentage': (offline_count / total_records * 100) if total_records > 0 else 0,
        'shuffle_usage_percentage': (shuffle_count / total_records * 100) if total_records > 0 else 0,
        'total_skips': skip_count,
        'total_completions': completion_count,
        'total_offline_plays': offline_count,
        'total_shuffle_plays': shuffle_count
    }
    
    # Temporal patterns
    stats['temporal_patterns'] = {
        'yearly_breakdown': dict(yearly_stats),
        'monthly_breakdown': dict(monthly_stats),
        'hourly_breakdown': dict(hourly_stats),
        'weekday_breakdown': dict(weekday_stats),
        'seasonal_breakdown': dict(seasonal_stats),
        'peak_listening_hour': max(hourly_stats.items(), key=lambda x: x[1]['plays'])[0] if hourly_stats else None,
        'peak_listening_day': max(weekday_stats.items(), key=lambda x: x[1]['plays'])[0] if weekday_stats else None,
        'peak_listening_season': max(seasonal_stats.items(), key=lambda x: x[1]['plays'])[0] if seasonal_stats else None
    }
    
    # Diversity metrics
    stats['diversity_metrics'] = calculate_diversity_metrics(records)
    
    # Top lists with plays and ms_played
    # Format: [name, plays, ms_played, artist (if applicable)]
    
    # Artists: [name, plays, ms_played] - sort by ms_played (hours)
    top_artists = []
    artist_data = []
    for artist_name, plays in artists.items():
        ms = int(artists_minutes.get(artist_name, 0) * 60 * 1000)
        artist_data.append([artist_name, plays, ms])
    top_artists = sorted(artist_data, key=lambda x: x[2], reverse=True)[:50]
    
    # Albums: [name, plays, ms_played] - sort by ms_played (hours)
    top_albums = []
    album_data = []
    for album_name, plays in albums.items():
        ms = int(albums_minutes.get(album_name, 0) * 60 * 1000)
        album_data.append([album_name, plays, ms])
    top_albums = sorted(album_data, key=lambda x: x[2], reverse=True)[:50]
    
    # Tracks: [name, plays, artist, ms_played] - sort by plays
    top_track_artists = []
    track_data = []
    for track_artist_key, plays in track_artists.items():
        track, artist = track_artist_key.split('|', 1)
        ms = int(track_artists_minutes.get(track_artist_key, 0) * 60 * 1000)
        track_data.append([track, plays, artist, ms])
    top_track_artists = sorted(track_data, key=lambda x: x[1], reverse=True)[:50]
    
    # Legacy tracks format (track name only): [name, plays, ms_played] - sort by plays
    top_tracks = []
    tracks_data = []
    for track_name, plays in tracks.items():
        ms = int(tracks_minutes.get(track_name, 0) * 60 * 1000)
        tracks_data.append([track_name, plays, ms])
    top_tracks = sorted(tracks_data, key=lambda x: x[1], reverse=True)[:50]
    
    stats['top_lists'] = {
        'top_artists': top_artists,
        'top_tracks': top_tracks,  # Legacy format
        'top_track_artists': top_track_artists,  # New format with proper track+artist combinations
        'top_albums': top_albums,
        'top_platforms': sorted(platforms.items(), key=lambda x: x[1], reverse=True),
        'top_countries': sorted(countries.items(), key=lambda x: x[1], reverse=True)
    }
    
    # Milestones and achievements
    stats['milestones'] = {
        'first_track_played': {
            'timestamp': earliest_date.isoformat() if earliest_date else None,
            'artist': records[0].get('master_metadata_album_artist_name') if records else None,
            'track': records[0].get('master_metadata_track_name') if records else None
        },
        'most_recent_track': {
            'timestamp': latest_date.isoformat() if latest_date else None,
            'artist': records[-1].get('master_metadata_album_artist_name') if records else None,
            'track': records[-1].get('master_metadata_track_name') if records else None
        },
        'longest_track_played': max(records, key=lambda x: x.get('ms_played', 0)) if records else None,
        'days_with_listening': len(set(parse_timestamp(r.get('ts', '')).date() for r in records if parse_timestamp(r.get('ts', '')) != datetime.min)),
        'average_daily_listening_minutes': total_minutes / len(set(parse_timestamp(r.get('ts', '')).date() for r in records if parse_timestamp(r.get('ts', '')) != datetime.min)) if records else 0
    }
    
    # Technical statistics
    stats['technical_stats'] = {
        'data_quality': {
            'records_with_timestamps': sum(1 for r in records if r.get('ts')),
            'records_with_artists': sum(1 for r in records if r.get('master_metadata_album_artist_name')),
            'records_with_tracks': sum(1 for r in records if r.get('master_metadata_track_name')),
            'records_with_duration': sum(1 for r in records if r.get('ms_played', 0) > 0)
        },
        'average_daily_tracks': total_records / ((latest_date - earliest_date).days + 1) if earliest_date and latest_date else 0,
        'tracks_per_hour_of_listening': total_records / total_hours if total_hours > 0 else 0
    }
    
    print(f"Generated comprehensive statistics for {total_records} records")
    return stats


def main():
    """Main entry point."""
    # Use relative paths from project root
    base_dir = Path(__file__).parent.parent
    consolidated_file = base_dir / 'output' / 'consolidated_full_streaming_data_clean.json'
    output_file = base_dir / 'output' / 'lifetime_streaming_stats.json'
    
    # Generate statistics
    stats = generate_lifetime_stats(str(consolidated_file))
    
    if not stats:
        print("Failed to generate statistics")
        return
    
    # Write output
    try:
        with open(output_file, 'w', encoding='utf-8') as file:
            json.dump(stats, file, indent=2, ensure_ascii=False)
        
        print(f"✅ Lifetime streaming statistics generated!")
        print(f"Output file: {output_file}")
        
        # Print some key highlights
        print(f"\n=== Key Highlights ===")
        if 'time_stats' in stats:
            print(f"Total listening time: {stats['time_stats']['total_hours']:.1f} hours ({stats['time_stats']['total_days']:.1f} days)")
            print(f"Average track length: {stats['time_stats']['average_track_length_minutes']:.1f} minutes")
        
        if 'content_stats' in stats:
            print(f"Unique artists: {stats['content_stats']['unique_artists']:,}")
            print(f"Unique tracks (names only): {stats['content_stats']['unique_tracks']:,}")
            print(f"Unique track+artist combinations: {stats['content_stats']['unique_track_artists']:,}")
            print(f"Total plays: {stats['content_stats']['total_plays']:,}")
        
        if 'top_lists' in stats and stats['top_lists']['top_artists']:
            print(f"Top artist: {stats['top_lists']['top_artists'][0][0]} ({stats['top_lists']['top_artists'][0][1]} plays)")
        
        if 'temporal_patterns' in stats:
            print(f"Peak listening hour: {stats['temporal_patterns']['peak_listening_hour']}:00")
            print(f"Peak listening day: {stats['temporal_patterns']['peak_listening_day']}")
        
        # Check file size
        output_path = Path(output_file)
        file_size_kb = output_path.stat().st_size / 1024
        print(f"Statistics file size: {file_size_kb:.1f} KB")
        
    except Exception as e:
        print(f"Error writing output file: {e}")


if __name__ == "__main__":
    main()
