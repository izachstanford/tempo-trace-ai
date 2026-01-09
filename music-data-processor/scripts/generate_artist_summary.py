#!/usr/bin/env python3
"""
Artist Summary Generator

This script processes consolidated streaming data and generates per-artist
summaries with yearly breakdowns and detailed statistics.

Usage: python generate_artist_summary.py
"""

import json
import sys
from pathlib import Path
from typing import List, Dict, Any, Set, Tuple
from datetime import datetime, timedelta
from collections import defaultdict, Counter


# Years to exclude entirely from summaries (incomplete years)
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


def generate_artist_summary(consolidated_file: str) -> Dict[str, Any]:
    """Generate per-artist summaries with yearly breakdowns."""
    print("Loading consolidated streaming data...")
    
    try:
        with open(consolidated_file, 'r', encoding='utf-8') as file:
            records = json.load(file)
    except Exception as e:
        print(f"Error loading file: {e}")
        return {}
    
    print(f"Processing {len(records)} records for artist summaries...")
    
    # Initialize artist data structure
    artist_data = defaultdict(lambda: {
        'total_streams': 0,
        'total_ms': 0,
        'yearly_breakdown': defaultdict(lambda: {
            'streams': 0,
            'minutes': 0,
            'hours': 0,
            'unique_tracks': set(),
            'unique_albums': set(),
            'platforms': defaultdict(int),
            'providers': defaultdict(int),
            'skip_count': 0,
            'completion_count': 0,
            'offline_count': 0,
            'shuffle_count': 0,
            'first_play': None,
            'last_play': None
        }),
        'tracks': defaultdict(int),
        'albums': defaultdict(int),
        'platforms': defaultdict(int),
        'providers': defaultdict(int),
        'countries': defaultdict(int),
        'first_played': None,
        'last_played': None,
        'skip_count': 0,
        'completion_count': 0,
        'offline_count': 0,
        'shuffle_count': 0,
        'unique_years': set(),
        'unique_days': set(),
        'track_lengths': []
    })
    
    # Process each record
    for record in records:
        artist = record.get('master_metadata_album_artist_name')
        if not artist:
            continue
            
        ts = record.get('ts')
        if not ts:
            continue
            
        dt = parse_timestamp(ts)
        if dt == datetime.min:
            continue
            
        year = dt.year
        
        # Skip future years, very old years, or excluded years
        if year < 2008 or year > datetime.now().year or year in EXCLUDED_YEARS:
            continue
        
        year_str = str(year)
        ms_played = record.get('ms_played', 0)
        minutes_played = ms_played / 1000 / 60
        hours_played = minutes_played / 60
        
        # Artist-level data
        artist_info = artist_data[artist]
        artist_info['total_streams'] += 1
        artist_info['total_ms'] += ms_played
        artist_info['unique_years'].add(year)
        artist_info['unique_days'].add(dt.date())
        artist_info['track_lengths'].append(ms_played)
        
        # Track first and last play dates
        if artist_info['first_played'] is None or dt < artist_info['first_played']:
            artist_info['first_played'] = dt
        if artist_info['last_played'] is None or dt > artist_info['last_played']:
            artist_info['last_played'] = dt
        
        # Content tracking
        track = record.get('master_metadata_track_name')
        album = record.get('master_metadata_album_album_name')
        provider = record.get('provider', 'Unknown')
        platform = clean_platform_name(record.get('platform', 'Unknown'))
        country = record.get('conn_country', 'Unknown')
        
        if track:
            artist_info['tracks'][track] += 1
        if album:
            artist_info['albums'][album] += 1
        
        artist_info['providers'][provider] += 1
        artist_info['platforms'][platform] += 1
        artist_info['countries'][country] += 1
        
        # Behavioral tracking
        if record.get('skipped', False):
            artist_info['skip_count'] += 1
        if record.get('reason_end') == 'trackdone':
            artist_info['completion_count'] += 1
        if record.get('offline', False):
            artist_info['offline_count'] += 1
        if record.get('shuffle', False):
            artist_info['shuffle_count'] += 1
        
        # Yearly breakdown
        year_data = artist_info['yearly_breakdown'][year_str]
        year_data['streams'] += 1
        year_data['minutes'] += minutes_played
        year_data['hours'] += hours_played
        
        if track:
            year_data['unique_tracks'].add(track)
        if album:
            year_data['unique_albums'].add(album)
        
        year_data['providers'][provider] += 1
        year_data['platforms'][platform] += 1
        
        # Behavioral tracking for year
        if record.get('skipped', False):
            year_data['skip_count'] += 1
        if record.get('reason_end') == 'trackdone':
            year_data['completion_count'] += 1
        if record.get('offline', False):
            year_data['offline_count'] += 1
        if record.get('shuffle', False):
            year_data['shuffle_count'] += 1
        
        # Track first and last play dates for year
        if year_data['first_play'] is None or dt < year_data['first_play']:
            year_data['first_play'] = dt
        if year_data['last_play'] is None or dt > year_data['last_play']:
            year_data['last_play'] = dt
    
    # Process artist data into final format
    artist_summary = {}
    
    for artist, data in artist_data.items():
        total_streams = data['total_streams']
        total_ms = data['total_ms']
        total_minutes = total_ms / 1000 / 60
        total_hours = total_minutes / 60
        
        # Calculate average track length
        avg_track_length_ms = sum(data['track_lengths']) / len(data['track_lengths']) if data['track_lengths'] else 0
        avg_track_length_minutes = avg_track_length_ms / 1000 / 60
        
        # Process yearly breakdown
        yearly_breakdown = {}
        for year_str, year_data in data['yearly_breakdown'].items():
            yearly_breakdown[year_str] = {
                'streams': year_data['streams'],
                'minutes': year_data['minutes'],
                'hours': year_data['hours'],
                'unique_tracks': len(year_data['unique_tracks']),
                'unique_albums': len(year_data['unique_albums']),
                'top_platform': max(year_data['platforms'].items(), key=lambda x: x[1])[0] if year_data['platforms'] else 'Unknown',
                'top_provider': max(year_data['providers'].items(), key=lambda x: x[1])[0] if year_data['providers'] else 'Unknown',
                'skip_rate_percentage': (year_data['skip_count'] / year_data['streams'] * 100) if year_data['streams'] > 0 else 0,
                'completion_rate_percentage': (year_data['completion_count'] / year_data['streams'] * 100) if year_data['streams'] > 0 else 0,
                'first_play': year_data['first_play'].isoformat() if year_data['first_play'] else None,
                'last_play': year_data['last_play'].isoformat() if year_data['last_play'] else None,
                'platform_breakdown': dict(year_data['platforms']),
                'provider_breakdown': dict(year_data['providers'])
            }
        
        # Calculate listening consistency
        years_active = len(data['unique_years'])
        days_active = len(data['unique_days'])
        
        # Calculate peak year
        peak_year = max(data['yearly_breakdown'].items(), key=lambda x: x[1]['streams']) if data['yearly_breakdown'] else None
        
        # Build final artist summary
        artist_summary[artist] = {
            'total_streams': total_streams,
            'total_minutes': total_minutes,
            'total_hours': total_hours,
            'unique_tracks': len(data['tracks']),
            'unique_albums': len(data['albums']),
            'years_active': years_active,
            'days_active': days_active,
            'first_played': data['first_played'].isoformat() if data['first_played'] else None,
            'last_played': data['last_played'].isoformat() if data['last_played'] else None,
            'avg_track_length_minutes': avg_track_length_minutes,
            'avg_streams_per_year': total_streams / years_active if years_active > 0 else 0,
            'avg_minutes_per_year': total_minutes / years_active if years_active > 0 else 0,
            'avg_streams_per_day': total_streams / days_active if days_active > 0 else 0,
            'avg_minutes_per_day': total_minutes / days_active if days_active > 0 else 0,
            'skip_rate_percentage': (data['skip_count'] / total_streams * 100) if total_streams > 0 else 0,
            'completion_rate_percentage': (data['completion_count'] / total_streams * 100) if total_streams > 0 else 0,
            'offline_percentage': (data['offline_count'] / total_streams * 100) if total_streams > 0 else 0,
            'shuffle_percentage': (data['shuffle_count'] / total_streams * 100) if total_streams > 0 else 0,
            'peak_year': peak_year[0] if peak_year else None,
            'peak_year_streams': peak_year[1]['streams'] if peak_year else 0,
            'top_tracks': sorted(data['tracks'].items(), key=lambda x: x[1], reverse=True)[:20],
            'top_albums': sorted(data['albums'].items(), key=lambda x: x[1], reverse=True)[:20],
            'top_platform': max(data['platforms'].items(), key=lambda x: x[1])[0] if data['platforms'] else 'Unknown',
            'top_provider': max(data['providers'].items(), key=lambda x: x[1])[0] if data['providers'] else 'Unknown',
            'countries_streamed_from': len(data['countries']),
            'top_countries': sorted(data['countries'].items(), key=lambda x: x[1], reverse=True)[:5],
            'platform_breakdown': dict(data['platforms']),
            'provider_breakdown': dict(data['providers']),
            'yearly_breakdown': yearly_breakdown
        }
    
    print(f"Generated summaries for {len(artist_summary)} artists")
    return artist_summary


def main():
    """Main entry point."""
    # Use relative paths from project root
    base_dir = Path(__file__).parent.parent
    consolidated_file = base_dir / 'output' / 'consolidated_full_streaming_data_clean.json'
    output_file = base_dir / 'output' / 'artist_summary.json'
    
    # Generate artist summaries
    summaries = generate_artist_summary(str(consolidated_file))
    
    if not summaries:
        print("Failed to generate artist summaries")
        return
    
    # Write output
    try:
        with open(output_file, 'w', encoding='utf-8') as file:
            json.dump(summaries, file, indent=2, ensure_ascii=False)
        
        print(f"✅ Artist summaries generated!")
        print(f"Output file: {output_file}")
        
        # Print summary statistics
        print(f"\n=== Artist Summary Statistics ===")
        print(f"Total artists: {len(summaries):,}")
        
        # Find most streamed artists
        top_artists = sorted(summaries.items(), key=lambda x: x[1]['total_streams'], reverse=True)[:10]
        print(f"\nTop 10 most streamed artists:")
        for i, (artist, data) in enumerate(top_artists, 1):
            print(f"{i:2d}. {artist}: {data['total_streams']:,} streams ({data['total_hours']:.1f}h)")
        
        # Find most active artists (years)
        longest_artists = sorted(summaries.items(), key=lambda x: x[1]['years_active'], reverse=True)[:5]
        print(f"\nLongest listening relationships:")
        for i, (artist, data) in enumerate(longest_artists, 1):
            years = data['years_active']
            first_year = data['first_played'][:4] if data['first_played'] else 'Unknown'
            last_year = data['last_played'][:4] if data['last_played'] else 'Unknown'
            print(f"{i}. {artist}: {years} years ({first_year}-{last_year})")
        
        # Calculate file size
        output_path = Path(output_file)
        file_size_mb = output_path.stat().st_size / (1024 * 1024)
        print(f"\nFile size: {file_size_mb:.1f} MB")
        
    except Exception as e:
        print(f"Error writing output file: {e}")


if __name__ == "__main__":
    main()
