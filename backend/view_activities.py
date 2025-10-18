#!/usr/bin/env python3
"""
Activity Log Viewer - View recent user and salon activities
Usage: python view_activities.py [options]
"""

import os
import argparse
from datetime import datetime, timedelta

def read_log_file(file_path, lines=10):
    """Read last N lines from log file"""
    if not os.path.exists(file_path):
        return f"❌ Log file not found: {file_path}"
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            all_lines = f.readlines()
            
        if not all_lines:
            return f"📝 Log file is empty: {file_path}"
            
        # Get last N non-empty lines
        recent_lines = [line.strip() for line in all_lines if line.strip()]
        recent_lines = recent_lines[-lines:] if len(recent_lines) > lines else recent_lines
        
        return recent_lines
    except Exception as e:
        return f"❌ Error reading log file: {e}"

def format_activity_line(line):
    """Format a log line for better readability"""
    try:
        # Split the line into components
        parts = line.split(' | ')
        if len(parts) < 3:
            return line
            
        timestamp = parts[0]
        actor = parts[1]
        action_part = parts[2]
        
        # Parse timestamp
        dt = datetime.strptime(timestamp, '%Y-%m-%d %H:%M:%S')
        time_ago = datetime.now() - dt
        
        if time_ago.days > 0:
            time_str = f"{time_ago.days}d ago"
        elif time_ago.seconds > 3600:
            hours = time_ago.seconds // 3600
            time_str = f"{hours}h ago"
        elif time_ago.seconds > 60:
            minutes = time_ago.seconds // 60
            time_str = f"{minutes}m ago"
        else:
            time_str = "just now"
            
        # Extract action
        action = action_part.split(': ')[1].split(' | ')[0] if ': ' in action_part else action_part
        
        # Color coding based on action type
        if 'LOGIN' in action:
            emoji = '[LOGIN]'
        elif 'REGISTERED' in action:
            emoji = '[REG]'
        elif 'BOOKING' in action:
            emoji = '[BOOK]'
        elif 'PAYMENT' in action:
            emoji = '[PAY]'
        elif 'VERIFIED' in action:
            emoji = '[VERIFY]'
        elif 'FAILED' in action or 'ERROR' in action:
            emoji = '[ERROR]'
        else:
            emoji = '[INFO]'
            
        return f"{emoji} {time_str:>8} | {actor:>30} | {action}"
        
    except Exception as e:
        return line

def view_activities(user_lines=10, salon_lines=10, filter_action=None, since_hours=None):
    """View recent activities from both log files"""
    
    # Define log file paths
    user_log = os.path.join('logs', 'user_activities.txt')
    salon_log = os.path.join('logs', 'salon_activities.txt')
    
    print("=" + "="*80)
    print("SALON BOOKING SYSTEM - ACTIVITY VIEWER")
    print("=" + "="*80)
    print()
    
    # User Activities
    print(f"USER ACTIVITIES (Last {user_lines} entries)")
    print("-" * 60)
    
    user_activities = read_log_file(user_log, user_lines)
    if isinstance(user_activities, str):
        print(user_activities)
    else:
        filtered_activities = []
        
        for line in user_activities:
            # Apply time filter
            if since_hours:
                try:
                    timestamp_str = line.split(' | ')[0]
                    line_time = datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S')
                    cutoff_time = datetime.now() - timedelta(hours=since_hours)
                    if line_time < cutoff_time:
                        continue
                except:
                    pass
                    
            # Apply action filter
            if filter_action and filter_action.upper() not in line.upper():
                continue
                
            filtered_activities.append(line)
        
        if not filtered_activities:
            print("No matching activities found")
        else:
            for line in filtered_activities:
                print(format_activity_line(line))
    
    print()
    
    # Salon Activities  
    print(f"SALON ACTIVITIES (Last {salon_lines} entries)")
    print("-" * 60)
    
    salon_activities = read_log_file(salon_log, salon_lines)
    if isinstance(salon_activities, str):
        print(salon_activities)
    else:
        filtered_activities = []
        
        for line in salon_activities:
            # Apply time filter
            if since_hours:
                try:
                    timestamp_str = line.split(' | ')[0]
                    line_time = datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S')
                    cutoff_time = datetime.now() - timedelta(hours=since_hours)
                    if line_time < cutoff_time:
                        continue
                except:
                    pass
                    
            # Apply action filter
            if filter_action and filter_action.upper() not in line.upper():
                continue
                
            filtered_activities.append(line)
        
        if not filtered_activities:
            print("No matching activities found")
        else:
            for line in filtered_activities:
                print(format_activity_line(line))
    
    print()
    print("=" + "="*80)
    
    # Statistics
    try:
        user_total = len(open(user_log, 'r').readlines()) if os.path.exists(user_log) else 0
        salon_total = len(open(salon_log, 'r').readlines()) if os.path.exists(salon_log) else 0
        
        print(f"STATISTICS:")
        print(f"   Total User Activities: {user_total}")
        print(f"   Total Salon Activities: {salon_total}")
        print(f"   Total Activities: {user_total + salon_total}")
        
        # Log file sizes
        user_size = os.path.getsize(user_log) if os.path.exists(user_log) else 0
        salon_size = os.path.getsize(salon_log) if os.path.exists(salon_log) else 0
        
        def format_bytes(bytes):
            for unit in ['B', 'KB', 'MB', 'GB']:
                if bytes < 1024.0:
                    return f"{bytes:.1f}{unit}"
                bytes /= 1024.0
            return f"{bytes:.1f}TB"
            
        print(f"   User Log Size: {format_bytes(user_size)}")
        print(f"   Salon Log Size: {format_bytes(salon_size)}")
        
    except Exception as e:
        print(f"Error calculating statistics: {e}")

def main():
    parser = argparse.ArgumentParser(
        description='View recent activities from salon booking system logs',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python view_activities.py                    # View last 10 activities from each log
  python view_activities.py -u 20 -s 15       # View last 20 user and 15 salon activities
  python view_activities.py -f LOGIN          # Filter for LOGIN activities only
  python view_activities.py -t 2              # Show activities from last 2 hours
  python view_activities.py -f PAYMENT -t 24  # Show payment activities from last 24 hours
        """
    )
    
    parser.add_argument('-u', '--user-lines', type=int, default=10,
                       help='Number of user activity lines to show (default: 10)')
    parser.add_argument('-s', '--salon-lines', type=int, default=10,
                       help='Number of salon activity lines to show (default: 10)')
    parser.add_argument('-f', '--filter', type=str,
                       help='Filter activities by action (e.g., LOGIN, BOOKING, PAYMENT)')
    parser.add_argument('-t', '--since-hours', type=int,
                       help='Show activities from last N hours only')
    
    args = parser.parse_args()
    
    view_activities(
        user_lines=args.user_lines,
        salon_lines=args.salon_lines,
        filter_action=args.filter,
        since_hours=args.since_hours
    )

if __name__ == '__main__':
    main()
