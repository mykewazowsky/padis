"use client";

import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import { LatLngBounds, LatLngTuple } from "leaflet";
import { useMemo } from "react";

type GeoJsonMiniMapProps = {
  data: GeoJSON.GeoJsonObject;
};

function FitBounds({ bounds }: { bounds: LatLngBounds }) {
  const map = useMap();
  map.fitBounds(bounds, { padding: [20, 20] });
  return null;
}

export default function GeoJsonMiniMap({ data }: GeoJsonMiniMapProps) {
  const bounds = useMemo(() => {
    const geo = data as any;
    const coords: LatLngTuple[] = [];

    function collectCoordinates(input: any) {
      if (!input) return;

      if (
        Array.isArray(input) &&
        input.length >= 2 &&
        typeof input[0] === "number" &&
        typeof input[1] === "number"
      ) {
        coords.push([input[1], input[0]]);
        return;
      }

      if (Array.isArray(input)) {
        for (const item of input) {
          collectCoordinates(item);
        }
      }
    }

    if (geo.type === "FeatureCollection") {
      for (const feature of geo.features || []) {
        collectCoordinates(feature?.geometry?.coordinates);
      }
    } else if (geo.type === "Feature") {
      collectCoordinates(geo.geometry?.coordinates);
    } else {
      collectCoordinates(geo.coordinates);
    }

    if (coords.length === 0) return null;

    return new LatLngBounds(coords);
  }, [data]);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200">
      <MapContainer
        className="h-72 w-full"
        center={[-2.5, 118]}
        zoom={5}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <GeoJSON data={data as any} />
        {bounds ? <FitBounds bounds={bounds} /> : null}
      </MapContainer>
    </div>
  );
}