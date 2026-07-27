#!/usr/bin/env bash

# Generate the Policy Evaluation GIF pairs from the fixed DROID source manifest.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
SOURCE_ROOT="/media/eric/data/droid_sim/data_from_qianjun/policy_eval_sim_3dgs-20260726T051956Z-1-001"
OUTPUT_ROOT="${REPO_ROOT}/outputs/policy_evaluation"
GENERATED_DIR="${OUTPUT_ROOT}/generated"
CONTACT_SHEETS_DIR="${OUTPUT_ROOT}/contact_sheets"
PROBES_DIR="${OUTPUT_ROOT}/probes"
LOGS_DIR="${OUTPUT_ROOT}/logs"
FINAL_DIR="${REPO_ROOT}/static/images/policy_evaluation"

EPISODES=(
  "GuptaLab_success_2023_04_20_14_40_40|video_raw_ext1.mp4|video_sim.mp4"
  "GuptaLab_success_2023_04_20_12_41_59|video_raw_ext1.mp4|video_sim.mp4"
  "CLVR_success_2023_05_21_19_29_34|video_raw_ext1.mp4|video_sim.mp4"
  "CLVR_success_2023_05_20_17_14_07|video_raw_ext1.mp4|video_sim.mp4"
  "AUTOLab_success_2023_07_14_15_13_14|video_raw_ext1.mp4|gs_hires_run3_canonical.mp4"
  "AUTOLab_success_2023_08_17_17_02_12|video_raw_ext1.mp4|video_sim.mp4"
  "GuptaLab_success_2023_05_19_10_46_48|video_raw_ext1.mp4|video_sim.mp4"
  "PennPAL_success_2023_04_29_18_21_36|video_raw_ext1.mp4|video_sim.mp4"
)

require_command() {
  command -v "$1" >/dev/null || {
    echo "Required command not found: $1" >&2
    exit 1
  }
}

probe_value() {
  local input="$1"
  local entries="$2"
  ffprobe -v error -count_frames -select_streams v:0 -show_entries "stream=${entries}" \
    -of default=noprint_wrappers=1:nokey=1 "$input"
}

assert_geometry() {
  local input="$1"
  local expected_width="$2"
  local expected_height="$3"
  local geometry
  geometry="$(probe_value "$input" 'width,height' | paste -sd x -)"
  [[ "$geometry" == "${expected_width}x${expected_height}" ]] || {
    echo "Unexpected geometry for ${input}: ${geometry} (expected ${expected_width}x${expected_height})" >&2
    exit 1
  }
}

write_probe_report() {
  local input="$1"
  local report="$2"
  {
    printf 'path=%s\n' "$input"
    ffprobe -v error -count_frames -show_entries \
      stream=codec_name,codec_type,width,height,avg_frame_rate,nb_read_frames,duration:format=duration,size \
      -of default=noprint_wrappers=1 "$input"
  } >"$report"
}

validate_gif() {
  local gif="$1"
  local source="$2"
  local width height frames gif_bytes source_bytes
  width="$(probe_value "$gif" width)"
  height="$(probe_value "$gif" height)"
  frames="$(probe_value "$gif" nb_read_frames)"
  gif_bytes="$(stat -c '%s' "$gif")"
  source_bytes="$(stat -c '%s' "$source")"

  [[ "$width" == '320' && "$height" == '180' ]] || {
    echo "Invalid GIF dimensions for ${gif}: ${width}x${height}" >&2
    exit 1
  }
  [[ "$frames" =~ ^[0-9]+$ && "$frames" -ge 139 && "$frames" -le 141 ]] || {
    echo "Invalid GIF frame count for ${gif}: ${frames}" >&2
    exit 1
  }
  [[ "$gif_bytes" -gt 0 && "$gif_bytes" -lt "$source_bytes" ]] || {
    echo "Unexpected GIF size for ${gif}: ${gif_bytes} bytes (source: ${source_bytes})" >&2
    exit 1
  }
}

generate_gif() {
  local input="$1"
  local output="$2"
  local kind="$3"
  local filter

  if [[ "$kind" == 'real' ]]; then
    filter='[0:v]fps=6,scale=320:180:flags=lanczos,split[frames][palette_source];[palette_source]palettegen=max_colors=64:stats_mode=diff[palette];[frames][palette]paletteuse=dither=sierra2_4a:diff_mode=rectangle'
  else
    filter='[0:v]crop=1280:720:0:0,fps=6,scale=320:180:flags=lanczos,split[frames][palette_source];[palette_source]palettegen=max_colors=64:stats_mode=diff[palette];[frames][palette]paletteuse=dither=sierra2_4a:diff_mode=rectangle'
  fi

  ffmpeg -hide_banner -loglevel error -y -i "$input" -filter_complex "$filter" -loop 0 "$output" \
    >"${LOGS_DIR}/$(basename "${output%.gif}").log" 2>&1
}

generate_contact_sheet() {
  local real_input="$1"
  local gaussian_input="$2"
  local output="$3"
  local filter
  filter="[0:v]select='eq(n\\,0)+eq(n\\,117)+eq(n\\,233)+eq(n\\,349)',scale=320:180:flags=lanczos,tile=4x1[real];[1:v]crop=1280:720:0:0,select='eq(n\\,0)+eq(n\\,117)+eq(n\\,233)+eq(n\\,349)',scale=320:180:flags=lanczos,tile=4x1[gaussian];[real][gaussian]vstack=inputs=2"
  ffmpeg -hide_banner -loglevel error -y -i "$real_input" -i "$gaussian_input" -filter_complex "$filter" \
    -frames:v 1 "$output" >"${LOGS_DIR}/$(basename "${output%.png}").log" 2>&1
}

require_command ffmpeg
require_command ffprobe
require_command sha256sum

mkdir -p "$GENERATED_DIR" "$CONTACT_SHEETS_DIR" "$PROBES_DIR" "$LOGS_DIR"

for index in "${!EPISODES[@]}"; do
  IFS='|' read -r directory real_name gaussian_name <<<"${EPISODES[$index]}"
  episode_number="$(printf '%02d' "$((index + 1))")"
  real_input="${SOURCE_ROOT}/${directory}/${real_name}"
  gaussian_input="${SOURCE_ROOT}/${directory}/${gaussian_name}"

  [[ "$real_input" != *video_simulated_twin.mp4 && "$gaussian_input" != *video_simulated_twin.mp4 ]] || {
    echo 'video_simulated_twin.mp4 is not an allowed input.' >&2
    exit 1
  }
  [[ -f "$real_input" && -f "$gaussian_input" ]] || {
    echo "Missing manifest input for episode ${episode_number}." >&2
    exit 1
  }
  assert_geometry "$real_input" 1280 720
  assert_geometry "$gaussian_input" 2560 720
done

find "$GENERATED_DIR" -maxdepth 1 -type f -name 'episode_*.gif' -delete

for index in "${!EPISODES[@]}"; do
  IFS='|' read -r directory real_name gaussian_name <<<"${EPISODES[$index]}"
  episode_number="$(printf '%02d' "$((index + 1))")"
  real_input="${SOURCE_ROOT}/${directory}/${real_name}"
  gaussian_input="${SOURCE_ROOT}/${directory}/${gaussian_name}"

  write_probe_report "$real_input" "${PROBES_DIR}/episode_${episode_number}_real_source.txt"
  write_probe_report "$gaussian_input" "${PROBES_DIR}/episode_${episode_number}_gaussian_source.txt"
  generate_contact_sheet "$real_input" "$gaussian_input" "${CONTACT_SHEETS_DIR}/episode_${episode_number}.png"
  generate_gif "$real_input" "${GENERATED_DIR}/episode_${episode_number}_real.gif" real
  generate_gif "$gaussian_input" "${GENERATED_DIR}/episode_${episode_number}_gaussian.gif" gaussian
done

mapfile -t generated_gifs < <(find "$GENERATED_DIR" -maxdepth 1 -type f -name 'episode_*.gif' -printf '%f\n' | sort)
[[ "${#generated_gifs[@]}" -eq 16 ]] || {
  echo "Expected 16 staged GIFs, found ${#generated_gifs[@]}." >&2
  exit 1
}

total_bytes=0
for index in "${!EPISODES[@]}"; do
  IFS='|' read -r directory real_name gaussian_name <<<"${EPISODES[$index]}"
  episode_number="$(printf '%02d' "$((index + 1))")"
  real_input="${SOURCE_ROOT}/${directory}/${real_name}"
  gaussian_input="${SOURCE_ROOT}/${directory}/${gaussian_name}"
  real_gif="${GENERATED_DIR}/episode_${episode_number}_real.gif"
  gaussian_gif="${GENERATED_DIR}/episode_${episode_number}_gaussian.gif"

  validate_gif "$real_gif" "$real_input"
  validate_gif "$gaussian_gif" "$gaussian_input"
  write_probe_report "$real_gif" "${PROBES_DIR}/episode_${episode_number}_real_output.txt"
  write_probe_report "$gaussian_gif" "${PROBES_DIR}/episode_${episode_number}_gaussian_output.txt"
  total_bytes=$((total_bytes + $(stat -c '%s' "$real_gif") + $(stat -c '%s' "$gaussian_gif")))
done

{
  printf 'total_gif_bytes=%s\n' "$total_bytes"
  printf 'total_gif_mib=%.2f\n' "$(awk "BEGIN { print ${total_bytes} / 1024 / 1024 }")"
  sha256sum "$GENERATED_DIR"/*.gif
} >"${PROBES_DIR}/generated_manifest.txt"

mkdir -p "$FINAL_DIR"
[[ -z "$(find "$FINAL_DIR" -maxdepth 1 -type f ! -name 'episode_*.gif' -print -quit)" ]] || {
  echo "Unexpected file already exists in ${FINAL_DIR}." >&2
  exit 1
}
find "$FINAL_DIR" -maxdepth 1 -type f -name 'episode_*.gif' -delete
install -m 0644 "$GENERATED_DIR"/*.gif "$FINAL_DIR"

mapfile -t final_gifs < <(find "$FINAL_DIR" -maxdepth 1 -type f -name 'episode_*.gif' -printf '%f\n' | sort)
[[ "${#final_gifs[@]}" -eq 16 ]] || {
  echo "Expected 16 installed GIFs, found ${#final_gifs[@]}." >&2
  exit 1
}
cmp <(sha256sum "$GENERATED_DIR"/*.gif | sed "s#${GENERATED_DIR}#.#") \
  <(sha256sum "$FINAL_DIR"/*.gif | sed "s#${FINAL_DIR}#.#")

printf 'Generated and installed 16 policy evaluation GIFs (%.2f MiB total).\n' \
  "$(awk "BEGIN { print ${total_bytes} / 1024 / 1024 }")"
