# PADIS System Workflow

## Actors
- Admin
- User

## Admin Functions
- Upload raster/vector/tabular data
- Edit selected data/metadata
- Trigger analysis rerun
- View processing status

## User Functions
- View final dashboard
- Explore map, table, and charts
- Filter results by hazard/wilayah

## Processing Workflow
1. Admin uploads data
2. System validates format and CRS
3. System preprocesses input data
4. System runs zonal statistics
5. System calculates hazard index
6. System calculates production loss
7. System calculates economic loss
8. System updates final output for dashboard

## Output Sources
- Processed data
- Analysis results
- Final dashboard-ready GeoJSON/CSV/API