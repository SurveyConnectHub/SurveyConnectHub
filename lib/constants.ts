export const PROFESSION_OPTIONS = [
	"land_surveyor",
	"gis_analyst",
	"drone_pilot",
	"cartographer",
	"photogrammetrist",
	"lidar_specialist",
	"remote_sensing_analyst",
	"urban_planner",
	"spatial_data_scientist",
	"hydrographic_surveyor",
	"mining_surveyor",
	"construction_surveyor",
	"environmental_analyst",
	"bim_specialist",
	"other",
] as const;

export type ProfessionType = (typeof PROFESSION_OPTIONS)[number];

export const PROFESSION_LABELS: Record<string, string> = {
	land_surveyor: "Land Surveyor",
	gis_analyst: "GIS Analyst",
	drone_pilot: "Drone/UAV Pilot",
	cartographer: "Cartographer",
	photogrammetrist: "Photogrammetrist",
	lidar_specialist: "LiDAR Specialist",
	remote_sensing_analyst: "Remote Sensing Analyst",
	urban_planner: "Urban Planner",
	spatial_data_scientist: "Spatial Data Scientist",
	hydrographic_surveyor: "Hydrographic Surveyor",
	mining_surveyor: "Mining Surveyor",
	construction_surveyor: "Construction Surveyor",
	environmental_analyst: "Environmental Analyst",
	bim_specialist: "BIM Specialist",
	other: "Other",
};

export function getProfessionLabel(type: string): string {
	return PROFESSION_LABELS[type] || type;
}

export const SOFTWARE_TOOL_OPTIONS = [
	"ArcGIS Pro",
	"QGIS",
	"ArcGIS Online",
	"Google Earth Engine",
	"GRASS GIS",
	"ENVI",
	"Global Mapper",
	"AutoCAD Civil 3D",
	"Pix4D",
	"Agisoft Metashape",
	"GDAL/OGR",
	"PostGIS",
	"FME",
	"Blender GIS",
	"Other",
] as const;

export const PORTFOLIO_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const MAX_PORTFOLIO_IMAGE_SIZE = 5 * 1024 * 1024;
