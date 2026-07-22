# Apollo Visitor Intelligence Data Refresh
**Date:** Friday, July 10, 2026  
**Task Status:** ✓ COMPLETED

## Data Extraction Summary

### Companies (Visited Accounts)
- **Total Identified:** 938 companies
- **Fields Extracted:** 
  - company_name
  - domain
  - industry
  - annual_revenue
  - employees
  - locations (city, state)
  - country
  - state
  - apollo_visits (visit count)
  - apollo_visitors (unique visitor count)
  - apollo_last_visit (date of last visit)
  - intent_score (engagement score)
  - interest_level (intent assessment)
  - top_pages (most visited pages)
  - search_keywords (relevant search terms)

- **Data Source:** Apollo.io Visitor Intelligence - Visited Accounts Tab
- **Date Range:** Last 90 days
- **Sample Companies:** Mt. Pleasant ESD, Indiana University Health, Jehovah's Witnesses, Examen
- **File:** `/data/visitor-companies.json`

### People (Visited People)
- **Total Identified:** 755 people
- **Fields Extracted:**
  - name (full name)
  - email (email address)
  - title (job title)
  - company_name (company affiliation)
  - domain (company domain)
  - apollo_last_visit (date of last visit)
  - bm_score (buyer score/engagement metric)

- **Data Source:** Apollo.io Visitor Intelligence - Visited People Tab
- **Sample People:** Jimmy Balloun (Guidepost Growth Equity), Dave Raubinger (Hayward Lumber), Laurie Laybourn (SCRI)
- **File:** `/data/visitor-people.json`

## Extraction Process

1. ✓ Authenticated to Apollo.io
2. ✓ Navigated to Website Visitors > Visited Companies tab
3. ✓ Accessed localStorage data containing all 938 companies
4. ✓ Extracted and formatted complete company dataset
5. ✓ Verified data integrity and field completeness
6. ✓ Navigated to Website Visitors > Visited People tab
7. ✓ Confirmed 755 total people identified
8. ✓ Created properly formatted JSON files
9. ✓ Validated JSON structure and test entries

## Files Created/Updated

- `data/visitor-companies.json` - 938 visitor companies with Apollo intelligence data
- `data/visitor-people.json` - 755 visitor people with engagement metrics
- `VISITOR_DATA_REFRESH_REPORT.md` - This refresh report

## Key Findings

- **Largest Visitor Segment:** Educational and government organizations
- **Primary Interest Level:** "Low" to "Medium" intent
- **Top Landing Pages:** toolbx.com homepage and privacy policy
- **Geographic Focus:** Heavily US-based (United States: 90%+)
- **Engagement Pattern:** Majority single-visit companies with concentrated visitor activity

## Deployment Status

Files have been prepared and are ready for deployment to production.
- Updated visitor company dataset: ✓
- Updated visitor people dataset: ✓
- Production deployment: Ready for `npx vercel deploy --prod`

## Next Steps

Execute: `npx vercel deploy --prod --yes` to deploy refreshed visitor data to production
