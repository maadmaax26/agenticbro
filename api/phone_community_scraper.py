#!/usr/bin/env python3
"""
Phone Community Reports Scraper
Scrapes 800notes.com and whocalledme.org for community spam reports
via Chrome CDP on port 18801

Usage:
    python3 phone_community_scraper.py "+1234567890"
    
Returns JSON with:
    - reports from each source
    - total community reports
    - scam mentions
    - community risk level
"""

import json
import sys
import re
import urllib.request
import urllib.error
from datetime import datetime
from typing import Dict, List, Optional, Any

CDP_PORT = 18801
CDP_URL = f"http://localhost:{CDP_PORT}/json"


class CDPConnection:
    """Chrome DevTools Protocol client for browser automation"""
    
    def __init__(self, port: int = CDP_PORT):
        self.port = port
        self.url = f"http://localhost:{port}/json"
        self._tab_id: Optional[str] = None
    
    def is_available(self) -> bool:
        """Check if Chrome CDP is accessible"""
        try:
            req = urllib.request.Request(self.url)
            with urllib.request.urlopen(req, timeout=5) as resp:
                return resp.status == 200
        except:
            return False
    
    def get_tabs(self) -> List[Dict]:
        """Get list of open browser tabs"""
        try:
            req = urllib.request.Request(self.url)
            with urllib.request.urlopen(req, timeout=5) as resp:
                return json.loads(resp.read().decode('utf-8'))
        except:
            return []
    
    def get_active_tab(self) -> Optional[str]:
        """Find an available browser tab"""
        tabs = self.get_tabs()
        for tab in tabs:
            url = tab.get('url', '')
            # Prefer newtab or about:blank
            if 'chrome://newtab' in url or 'about:blank' in url:
                return tab.get('id')
        # Fall back to any page tab
        for tab in tabs:
            if tab.get('type') == 'page':
                return tab.get('id')
        return tabs[0].get('id') if tabs else None
    
    def navigate(self, tab_id: str, url: str) -> bool:
        """Navigate tab to URL"""
        try:
            payload = json.dumps({
                "method": "Page.navigate",
                "params": {"frameId": tab_id, "url": url},
                "id": 1
            }).encode('utf-8')
            
            req = urllib.request.Request(
                f"http://localhost:{self.port}/json",
                data=payload,
                headers={'Content-Type': 'application/json'}
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                return resp.status == 200
        except:
            return False
    
    def get_page_content(self, tab_id: str) -> Optional[str]:
        """Extract page text content"""
        try:
            payload = json.dumps({
                "method": "Runtime.evaluate",
                "params": {"expression": "document.body.innerText"},
                "id": 1
            }).encode('utf-8')
            
            req = urllib.request.Request(
                f"http://localhost:{self.port}/json",
                data=payload,
                headers={'Content-Type': 'application/json'}
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                return data.get('result', {}).get('result', {}).get('value', '')
        except:
            return None


class PhoneCommunityScraper:
    """Scrape community reports from multiple sources"""
    
    def __init__(self):
        self.cdp = CDPConnection()
        self._cdp_available: Optional[bool] = None
    
    @property
    def cdp_available(self) -> bool:
        if self._cdp_available is None:
            self._cdp_available = self.cdp.is_available()
        return self._cdp_available
    
    def scan_800notes(self, phone: str) -> Dict[str, Any]:
        """Scrape 800notes.com for community reports"""
        result = {
            "source": "800notes.com",
            "url": f"https://800notes.com/Phone.aspx/{phone}",
            "reports": [],
            "total": 0,
            "scam_mentions": 0,
            "last_report_date": None
        }
        
        if not self.cdp_available:
            result["error"] = "CDP not available"
            return result
        
        tab_id = self.cdp.get_active_tab()
        if not tab_id:
            result["error"] = "No browser tab available"
            return result
        
        # Navigate to 800notes
        url = f"https://800notes.com/Phone.aspx/{phone}"
        if not self.cdp.navigate(tab_id, url):
            result["error"] = "Navigation failed"
            return result
        
        import time
        time.sleep(2)  # Wait for page load
        
        content = self.cdp.get_page_content(tab_id)
        if not content:
            result["error"] = "Failed to extract page content"
            return result
        
        # Parse content
        result.update(self._parse_800notes(content))
        return result
    
    def scan_whocalledme(self, phone: str) -> Dict[str, Any]:
        """Scrape whocalledme.org for community reports"""
        result = {
            "source": "whocalledme.org",
            "url": f"https://www.whocalledme.org/phone/{phone}",
            "reports": [],
            "total": 0,
            "scam_mentions": 0,
            "spam_score": 0,
            "risk_level": "unknown",
            "last_report_date": None
        }
        
        if not self.cdp_available:
            result["error"] = "CDP not available"
            return result
        
        tab_id = self.cdp.get_active_tab()
        if not tab_id:
            result["error"] = "No browser tab available"
            return result
        
        # Navigate to whocalledme
        url = f"https://www.whocalledme.org/phone/{phone}"
        if not self.cdp.navigate(tab_id, url):
            result["error"] = "Navigation failed"
            return result
        
        import time
        time.sleep(2)  # Wait for page load
        
        content = self.cdp.get_page_content(tab_id)
        if not content:
            result["error"] = "Failed to extract page content"
            return result
        
        # Parse content
        result.update(self._parse_whocalledme(content))
        return result
    
    def _parse_800notes(self, content: str) -> Dict[str, Any]:
        """Parse 800notes page content"""
        # Count scam-related keywords
        scam_keywords = r'\b(scam|fraud|spam|robocall|harassment|fake|phishing|threat|warning)\b'
        scam_mentions = len(re.findall(scam_keywords, content, re.I))
        
        # Look for call count
        call_match = re.search(r'(\d+)\s*(?:calls?|reports?|complaints?)', content, re.I)
        total_calls = int(call_match.group(1)) if call_match else 0
        
        # Extract comments with dates
        comment_pattern = r'(\d{1,2}/\d{1,2}/\d{2,4}[^"]*?)(?=\d{1,2}/\d{1,2}/\d{2,4}|$)'
        comments = re.findall(comment_pattern, content)
        
        # Extract last report date
        date_matches = re.findall(r'(\d{1,2}/\d{1,2}/\d{2,4})', content)
        last_date = None
        if date_matches:
            try:
                last_date = date_matches[-1]  # Most recent date
            except:
                pass
        
        return {
            "reports": comments[:10],
            "total": max(total_calls, scam_mentions * 5),
            "scam_mentions": scam_mentions,
            "last_report_date": last_date
        }
    
    def _parse_whocalledme(self, content: str) -> Dict[str, Any]:
        """Parse whocalledme page content"""
        # Count scam keywords
        scam_keywords = r'\b(scam|fraud|spam|robocall|harassment|fake|phishing|threat)\b'
        scam_mentions = len(re.findall(scam_keywords, content, re.I))
        
        # Look for call count
        call_match = re.search(r'(\d+)\s*(?:calls?|reports?|complaints?)', content, re.I)
        total_calls = int(call_match.group(1)) if call_match else 0
        
        # Look for spam/risk score
        score_match = re.search(r'(?:spam\s*score|risk\s*score|rating)[:\s]*(\d+)', content, re.I)
        spam_score = int(score_match.group(1)) if score_match else 0
        
        # Look for risk level
        level_match = re.search(r'(?:risk|level|rating)[:\s]*(high|medium|low|critical|safe)', content, re.I)
        risk_level = level_match.group(1).lower() if level_match else "unknown"
        
        # Extract comments
        comment_pattern = r'(\d{1,2}/\d{1,2}/\d{2,4}[^"]*?)(?=\d{1,2}/\d{1,2}/\d{2,4}|$)'
        comments = re.findall(comment_pattern, content)
        
        # Last report date
        date_matches = re.findall(r'(\d{1,2}/\d{1,2}/\d{2,4})', content)
        last_date = date_matches[-1] if date_matches else None
        
        return {
            "reports": comments[:10],
            "total": max(total_calls, scam_mentions * 3),
            "scam_mentions": scam_mentions,
            "spam_score": spam_score,
            "risk_level": risk_level,
            "last_report_date": last_date
        }
    
    def scan_all_sources(self, phone: str) -> Dict[str, Any]:
        """Scan all community report sources"""
        phone = phone.lstrip('+').replace(' ', '').replace('-', '')
        
        notes_data = self.scan_800notes(phone)
        who_data = self.scan_whocalledme(phone)
        
        # Calculate aggregates
        total_reports = notes_data.get('total', 0) + who_data.get('total', 0)
        total_scam_mentions = notes_data.get('scam_mentions', 0) + who_data.get('scam_mentions', 0)
        
        # Determine community risk level
        if total_reports > 100 or total_scam_mentions > 20:
            community_risk = "HIGH"
        elif total_reports > 20 or total_scam_mentions > 5:
            community_risk = "MEDIUM"
        elif total_reports > 0:
            community_risk = "LOW"
        else:
            community_risk = "NONE"
        
        # Get most recent report date
        last_dates = [
            notes_data.get('last_report_date'),
            who_data.get('last_report_date')
        ]
        last_dates = [d for d in last_dates if d]
        
        return {
            "phone": f"+{phone}",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "sources": [notes_data, who_data],
            "aggregate": {
                "total_reports": total_reports,
                "scam_mentions": total_scam_mentions,
                "community_risk": community_risk,
                "last_report_date": last_dates[-1] if last_dates else None
            }
        }


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 phone_community_scraper.py \"+1234567890\"", file=sys.stderr)
        sys.exit(1)
    
    phone = sys.argv[1]
    scraper = PhoneCommunityScraper()
    
    result = scraper.scan_all_sources(phone)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()