"""
Simple HTTP Server for Pronunciation Analysis Web App
Serves the web interface and meeting data files
"""

import http.server
import socketserver
import os
import json
import webbrowser
import argparse
from pathlib import Path
from urllib.parse import urlparse, unquote

PORT = 8080
DIRECTORY = Path(__file__).parent


class MeetingDataHandler(http.server.SimpleHTTPRequestHandler):
    """Custom handler that serves from project root and handles CORS"""
    
    def __init__(self, *args, **kwargs):
        # Serve from project root, not just web folder
        super().__init__(*args, directory=str(DIRECTORY.parent), **kwargs)
    
    def end_headers(self):
        # Add CORS headers
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()
    
    def do_GET(self):
        # Parse the path
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        
        # Handle root request - serve index.html from web folder
        if path == '/' or path == '':
            self.path = '/web/index.html'
        elif path in ['/styles.css', '/app.js']:
            # Redirect to web folder
            self.path = f'/web{path}'
        elif path.startswith('/web/'):
            pass  # Serve from web folder
        elif path == '/meetings.json':
            # Serve the static meetings.json file from project root
            meetings_file = DIRECTORY.parent / 'meetings.json'
            if meetings_file.exists():
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(meetings_file.read_bytes())
                return
            else:
                # Fallback to dynamic scan
                self.send_meetings_list()
                return
        elif path == '/api/scan-meetings':
            # API endpoint to scan for meetings
            self.send_meetings_list()
            return
        
        # Default handling
        super().do_GET()
    
    def send_meetings_list(self):
        """Scan for available meetings with pronunciation data"""
        meetings = []
        root = DIRECTORY.parent
        
        # Scan for folders with mispronunciation_summary.json
        for folder in root.iterdir():
            if folder.is_dir() and not folder.name.startswith('.') and folder.name not in ['web', '__pycache__', '.venv', 'venv', 'configs', 'dataset', 'gdrive_dataset', 'finetuned_whisper_nptel', '--input_folder']:
                # Check new structure first: participant_transcripts/mispronunciation_summary.json
                summary_file = folder / 'participant_transcripts' / 'mispronunciation_summary.json'
                if summary_file.exists():
                    meetings.append({
                        'folder': folder.name,
                        'name': folder.name.replace('_', ' ').title(),
                        'has_data': True
                    })
                    continue
                
                # Check old structure: output/participant_transcripts/mispronunciation_summary.json
                summary_file_old = folder / 'output' / 'participant_transcripts' / 'mispronunciation_summary.json'
                if summary_file_old.exists():
                    meetings.append({
                        'folder': folder.name,
                        'name': folder.name.replace('_', ' ').title(),
                        'has_data': True
                    })
                    continue
                
                # Check if it has transcript data at least (new structure)
                transcript_folder = folder / 'participant_transcripts'
                if transcript_folder.exists():
                    meetings.append({
                        'folder': folder.name,
                        'name': f'{folder.name.replace("_", " ").title()} (No pronunciation data)',
                        'has_data': False
                    })
                    continue
                    
                # Check old structure
                transcript_folder_old = folder / 'output' / 'participant_transcripts'
                if transcript_folder_old.exists():
                    meetings.append({
                        'folder': folder.name,
                        'name': f'{folder.name.replace("_", " ").title()} (No pronunciation data)',
                        'has_data': False
                    })
        
        # Sort by name
        meetings.sort(key=lambda x: x['name'])
        
        # Send response
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(meetings).encode())


def run_server(port=PORT, open_browser=True):
    """Start the web server"""
    print(f"\n{'='*60}")
    print("PRONUNCIATION ANALYSIS WEB SERVER")
    print(f"{'='*60}")
    print(f"\nStarting server at http://localhost:{port}")
    print(f"Serving from: {DIRECTORY.parent}")
    print(f"\nPress Ctrl+C to stop the server")
    print(f"{'='*60}\n")
    
    # Create server with address reuse
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", port), MeetingDataHandler) as httpd:
        # Open browser
        if open_browser:
            url = f"http://localhost:{port}"
            print(f"Opening browser at {url}...")
            webbrowser.open(url)
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\nServer stopped.")


def main():
    parser = argparse.ArgumentParser(description="Pronunciation Analysis Web Server")
    parser.add_argument('--port', type=int, default=PORT, help='Port to run server on')
    parser.add_argument('--no-browser', action='store_true', help='Do not open browser automatically')
    args = parser.parse_args()
    
    run_server(port=args.port, open_browser=not args.no_browser)


if __name__ == "__main__":
    main()
