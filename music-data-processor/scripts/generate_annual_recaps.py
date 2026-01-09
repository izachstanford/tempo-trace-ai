#!/usr/bin/env python3
"""
Annual Recaps Generator

This script processes consolidated streaming data and generates year-by-year
recaps with top 50 artists, albums, tracks, and annual statistics.

Usage: python generate_annual_recaps.py
"""

import json
import sys
from pathlib import Path
from typing import List, Dict, Any, Set, Tuple
from datetime import datetime, timedelta
from collections import defaultdict, Counter


# Years to exclude entirely from recaps (incomplete years)
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


def generate_annual_recaps(consolidated_file: str) -> Dict[str, Any]:
    """Generate annual recaps with top lists and yearly statistics."""
    print("Loading consolidated streaming data...")
    
    try:
        with open(consolidated_file, 'r', encoding='utf-8') as file:
            records = json.load(file)
    except Exception as e:
        print(f"Error loading file: {e}")
        return {}
    
    print(f"Processing {len(records)} records for annual recaps...")
    
    # Initialize yearly data structure
    yearly_data = defaultdict(lambda: {
        'artists': defaultdict(int),
        'artists_minutes': defaultdict(float),
        'tracks': defaultdict(int),
        'tracks_minutes': defaultdict(float),
        'track_artists': defaultdict(int),  # track+artist combinations
        'track_artists_minutes': defaultdict(float),
        'albums': defaultdict(int),
        'albums_minutes': defaultdict(float),
        'album_artists': defaultdict(int),  # album+artist combinations
        'album_artists_minutes': defaultdict(float),
        'platforms': defaultdict(int),
        'providers': defaultdict(int),
        'countries': defaultdict(int),
        'months': defaultdict(lambda: {'plays': 0, 'ms_played': 0}),
        'total_plays': 0,
        'total_ms': 0,
        'skip_count': 0,
        'completion_count': 0,
        'offline_count': 0,
        'shuffle_count': 0,
        'unique_days': set(),
        'first_play': None,
        'last_play': None
    })
    
    # Process each record
    for record in records:
        ts = record.get('ts')
        if not ts:
            continue
            
        dt = parse_timestamp(ts)
        if dt == datetime.min:
            continue
            
        year = dt.year
        month = dt.month
        
        # Skip future years, very old years, or excluded years
        if year < 2008 or year > datetime.now().year or year in EXCLUDED_YEARS:
            continue
        
        year_str = str(year)
        year_data = yearly_data[year_str]
        
        # Basic metrics
        ms_played = record.get('ms_played', 0)
        year_data['total_plays'] += 1
        year_data['total_ms'] += ms_played
        
        # Content tracking
        artist = record.get('master_metadata_album_artist_name')
        track = record.get('master_metadata_track_name')
        album = record.get('master_metadata_album_album_name')
        provider = record.get('provider', 'Unknown')
        platform = clean_platform_name(record.get('platform', 'Unknown'))
        country = record.get('conn_country', 'Unknown')
        
        # Years to exclude from album stats (90%+ Apple Music)
        EXCLUDED_ALBUM_YEARS = {2016, 2017, 2020, 2021}
        
        if artist:
            year_data['artists'][artist] += 1
            year_data['artists_minutes'][artist] += ms_played / 1000 / 60
        if track:
            year_data['tracks'][track] += 1
            year_data['tracks_minutes'][track] += ms_played / 1000 / 60
            # Track+artist combinations for accurate aggregation
            if artist:
                track_artist_key = f"{track}|{artist}"
                year_data['track_artists'][track_artist_key] += 1
                year_data['track_artists_minutes'][track_artist_key] += ms_played / 1000 / 60
        
        # Only track albums from Spotify (Apple Music has no album data)
        # Also exclude years that are 90%+ Apple Music
        if album and provider == 'Spotify' and year not in EXCLUDED_ALBUM_YEARS:
            year_data['albums'][album] += 1
            year_data['albums_minutes'][album] += ms_played / 1000 / 60
            # Album+artist combinations for accurate aggregation
            if artist:
                album_artist_key = f"{album}|{artist}"
                year_data['album_artists'][album_artist_key] += 1
                year_data['album_artists_minutes'][album_artist_key] += ms_played / 1000 / 60
        
        year_data['providers'][provider] += 1
        year_data['platforms'][platform] += 1
        year_data['countries'][country] += 1
        
        # Monthly breakdown
        month_key = f"{month:02d}"
        year_data['months'][month_key]['plays'] += 1
        year_data['months'][month_key]['ms_played'] += ms_played
        
        # Behavioral tracking
        if record.get('skipped', False):
            year_data['skip_count'] += 1
        if record.get('reason_end') == 'trackdone':
            year_data['completion_count'] += 1
        if record.get('offline', False):
            year_data['offline_count'] += 1
        if record.get('shuffle', False):
            year_data['shuffle_count'] += 1
        
        # Date tracking
        year_data['unique_days'].add(dt.date())
        if year_data['first_play'] is None or dt < year_data['first_play']:
            year_data['first_play'] = dt
        if year_data['last_play'] is None or dt > year_data['last_play']:
            year_data['last_play'] = dt
    
    # Process yearly data into final format
    annual_recaps = {}
    
    for year_str, data in yearly_data.items():
        if data['total_plays'] == 0:
            continue
            
        year = int(year_str)
        total_plays = data['total_plays']
        total_ms = data['total_ms']
        total_minutes = total_ms / 1000 / 60
        total_hours = total_minutes / 60
        
        # Calculate year statistics
        year_stats = {
            'total_plays': total_plays,
            'total_minutes': total_minutes,
            'total_hours': total_hours,
            'unique_artists': len(data['artists']),
            'unique_tracks': len(data['tracks']),
            'unique_albums': len(data['albums']),
            'unique_days_with_listening': len(data['unique_days']),
            'average_track_length_minutes': total_minutes / total_plays if total_plays > 0 else 0,
            'average_daily_minutes': total_minutes / len(data['unique_days']) if data['unique_days'] else 0,
            'skip_rate_percentage': (data['skip_count'] / total_plays * 100) if total_plays > 0 else 0,
            'completion_rate_percentage': (data['completion_count'] / total_plays * 100) if total_plays > 0 else 0,
            'offline_percentage': (data['offline_count'] / total_plays * 100) if total_plays > 0 else 0,
            'shuffle_percentage': (data['shuffle_count'] / total_plays * 100) if total_plays > 0 else 0,
            'first_play': data['first_play'].isoformat() if data['first_play'] else None,
            'last_play': data['last_play'].isoformat() if data['last_play'] else None
        }
        
        # Find peak month
        peak_month = max(data['months'].items(), key=lambda x: x[1]['plays']) if data['months'] else None
        if peak_month:
            month_names = ['', 'January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December']
            year_stats['peak_month'] = month_names[int(peak_month[0])]
            year_stats['peak_month_plays'] = peak_month[1]['plays']
        
        # Top platform and provider
        if data['platforms']:
            year_stats['top_platform'] = max(data['platforms'].items(), key=lambda x: x[1])
        if data['providers']:
            year_stats['top_provider'] = max(data['providers'].items(), key=lambda x: x[1])
        
        # Provider breakdown
        year_stats['provider_breakdown'] = dict(data['providers'])
        year_stats['platform_breakdown'] = dict(data['platforms'])
        
        # Monthly breakdown
        monthly_breakdown = {}
        for month_key, month_data in data['months'].items():
            month_num = int(month_key)
            month_names = ['', 'January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December']
            monthly_breakdown[month_names[month_num]] = {
                'plays': month_data['plays'],
                'minutes': month_data['ms_played'] / 1000 / 60,
                'hours': month_data['ms_played'] / 1000 / 60 / 60
            }
        year_stats['monthly_breakdown'] = monthly_breakdown
        
        # Create top artists with ms_played: [name, plays, ms_played] - sort by ms (hours)
        artist_data = []
        for name, plays in data['artists'].items():
            ms = int(data['artists_minutes'].get(name, 0) * 60 * 1000)
            artist_data.append([name, plays, ms])
        top_artists = sorted(artist_data, key=lambda x: x[2], reverse=True)[:50]
        
        # Create top tracks with ms_played: [name, plays, ms_played] - sort by plays
        track_data = []
        for name, plays in data['tracks'].items():
            ms = int(data['tracks_minutes'].get(name, 0) * 60 * 1000)
            track_data.append([name, plays, ms])
        top_tracks = sorted(track_data, key=lambda x: x[1], reverse=True)[:50]
        
        # Create top track+artist combinations: [name, plays, artist, ms_played] - sort by plays
        track_artist_data = []
        for track_artist_key, play_count in data['track_artists'].items():
            track_name, artist_name = track_artist_key.split('|', 1)
            ms = int(data['track_artists_minutes'].get(track_artist_key, 0) * 60 * 1000)
            track_artist_data.append([track_name, play_count, artist_name, ms])
        top_track_artists = sorted(track_artist_data, key=lambda x: x[1], reverse=True)[:50]
        
        # Create top albums with ms_played: [name, plays, ms_played] - sort by ms (hours)
        album_data = []
        for name, plays in data['albums'].items():
            ms = int(data['albums_minutes'].get(name, 0) * 60 * 1000)
            album_data.append([name, plays, ms])
        top_albums = sorted(album_data, key=lambda x: x[2], reverse=True)[:50]
        
        # Create top album+artist combinations: [name, plays, artist, ms_played] - sort by ms (hours)
        album_artist_data = []
        for album_artist_key, play_count in data['album_artists'].items():
            album_name, artist_name = album_artist_key.split('|', 1)
            ms = int(data['album_artists_minutes'].get(album_artist_key, 0) * 60 * 1000)
            album_artist_data.append([album_name, play_count, artist_name, ms])
        top_album_artists = sorted(album_artist_data, key=lambda x: x[3], reverse=True)[:50]
        
        # Create the annual recap entry
        annual_recaps[year_str] = {
            'year': year,
            'top_artists': top_artists,
            'top_tracks': top_tracks,
            'top_track_artists': top_track_artists,  # New format with track+artist combinations
            'top_albums': top_albums,
            'top_album_artists': top_album_artists,  # New format with album+artist combinations
            'year_stats': year_stats
        }
    
    print(f"Generated annual recaps for {len(annual_recaps)} years")
    return annual_recaps


def main():
    """Main entry point."""
    # Use relative paths from project root
    base_dir = Path(__file__).parent.parent
    consolidated_file = base_dir / 'output' / 'consolidated_full_streaming_data_clean.json'
    output_file = base_dir / 'output' / 'annual_recaps.json'
    
    # Generate annual recaps
    recaps = generate_annual_recaps(str(consolidated_file))
    
    if not recaps:
        print("Failed to generate annual recaps")
        return
    
    # Write output
    try:
        with open(output_file, 'w', encoding='utf-8') as file:
            json.dump(recaps, file, indent=2, ensure_ascii=False)
        
        print(f"✅ Annual recaps generated!")
        print(f"Output file: {output_file}")
        
        # Print summary
        print(f"\n=== Annual Recaps Summary ===")
        years = sorted(recaps.keys())
        print(f"Years covered: {years[0]} - {years[-1]} ({len(years)} years)")
        
        for year in years:
            stats = recaps[year]['year_stats']
            top_artist = recaps[year]['top_artists'][0] if recaps[year]['top_artists'] else ('Unknown', 0)
            print(f"{year}: {stats['total_plays']:,} plays, {stats['total_hours']:.1f}h, top: {top_artist[0]} ({top_artist[1]} plays)")
        
        # Check file size
        output_path = Path(output_file)
        file_size_kb = output_path.stat().st_size / 1024
        print(f"\nFile size: {file_size_kb:.1f} KB")
        
    except Exception as e:
        print(f"Error writing output file: {e}")


if __name__ == "__main__":
    main()
