#!/bin/bash
set -e
cd "$(dirname "$0")"
FAL_KEY=$(grep '^FAL_KEY' /Users/dorfarjun/Documents/GitHub/ai-test/.env | head -1 | sed -E 's/^FAL_KEY[[:space:]]*=[[:space:]]*//; s/^"//; s/"$//')
MODEL="https://fal.run/fal-ai/flux-pro/v1.1"

gen () {
  local name="$1"; local size="$2"; local prompt="$3"
  echo "generating $name ..."
  local resp
  resp=$(curl -s -X POST "$MODEL" \
    -H "Authorization: Key $FAL_KEY" \
    -H "Content-Type: application/json" \
    -d "$(python3 -c 'import json,sys; print(json.dumps({"prompt": sys.argv[1], "image_size": sys.argv[2], "num_images":1, "output_format":"jpeg"}))' "$prompt" "$size")")
  local url
  url=$(echo "$resp" | python3 -c "import json,sys; r=json.load(sys.stdin); print(r['images'][0]['url'])" 2>/dev/null || true)
  if [ -z "$url" ]; then echo "FAILED $name: $resp"; return 1; fi
  curl -s "$url" -o "$name.jpg"
  echo "saved $name.jpg ($(wc -c < "$name.jpg") bytes)"
}

gen hero landscape_16_9 "Cinematic wide travel photograph of the Sicilian coastline near Taormina at golden hour, turquoise Mediterranean sea below dramatic green cliffs, the smoking silhouette of Mount Etna volcano in the far distance, warm soft evening sunlight, cypress trees, lush mediterranean vegetation, ultra realistic, high detail, professional landscape photography, no text"
gen ortigia landscape_4_3 "Charming narrow old-town alley in Ortigia Syracuse Sicily at sunset, honey-colored baroque stone buildings, warm string lights, small cafe tables, potted plants, glowing golden light, cozy inviting mediterranean atmosphere, travel photography, no people close up, no text"
gen temples landscape_4_3 "Ancient Greek temple of golden limestone at sunset, Valley of the Temples Agrigento Sicily, dramatic warm orange light, long shadows, clear sky, majestic classical ruins on a ridge, travel photography, ultra realistic, no text"
gen food square_hd "Close-up food photograph of fresh Sicilian cannoli filled with ricotta and pistachio, and colorful arancini, on a rustic market stall in Palermo, vibrant, appetizing, natural light, shallow depth of field, mouthwatering, professional food photography, no text"
gen etna landscape_4_3 "Dramatic landscape photograph of Mount Etna volcano in Sicily, dark black volcanic lava fields in foreground, smoking crater, moody atmospheric light, vast rugged terrain, travel photography, ultra realistic, no text"
gen cefalu landscape_4_3 "Beautiful coastal town of Cefalu Sicily seen from the beach at golden hour, old stone houses right at the turquoise sea edge, sandy beach, warm mediterranean light, fishing boats, iconic travel photography, no text"
echo "ALL DONE"
