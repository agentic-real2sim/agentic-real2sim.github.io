#!/usr/bin/env bash

# Generate timestamp-aligned Policy Evaluation GIFs from the fixed DROID manifest.
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
INSTALL_STAGING_DIR=""

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

cleanup() {
  [[ -z "${INSTALL_STAGING_DIR}" || ! -d "${INSTALL_STAGING_DIR}" ]] || rm -rf -- "${INSTALL_STAGING_DIR}"
}
trap cleanup EXIT

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

format_duration() {
  ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$1"
}

assert_approx() {
  local actual="$1"
  local expected="$2"
  local tolerance="$3"
  awk -v actual="$actual" -v expected="$expected" -v tolerance="$tolerance" \
    'BEGIN { exit !(actual >= expected - tolerance && actual <= expected + tolerance) }' || {
      echo "Expected ${expected} ± ${tolerance}, got ${actual}." >&2
      exit 1
    }
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

assert_source() {
  local input="$1"
  local expected_width="$2"
  local expected_height="$3"
  local rate frames start_time duration
  rate="$(probe_value "$input" avg_frame_rate)"
  frames="$(probe_value "$input" nb_read_frames)"
  start_time="$(probe_value "$input" start_time)"
  duration="$(format_duration "$input")"

  assert_geometry "$input" "$expected_width" "$expected_height"
  [[ "$rate" == '15/1' ]] || {
    echo "Unexpected frame rate for ${input}: ${rate}" >&2
    exit 1
  }
  [[ "$frames" == '350' ]] || {
    echo "Unexpected decoded frame count for ${input}: ${frames}" >&2
    exit 1
  }
  assert_approx "$start_time" 0 0.00001
  assert_approx "$duration" 23.333333 0.001
}

write_probe_report() {
  local input="$1"
  local report="$2"
  {
    printf 'path=%s\n' "$input"
    ffprobe -v error -count_frames -show_entries \
      stream=codec_name,codec_type,width,height,avg_frame_rate,start_time,nb_read_frames,duration:format=duration,size \
      -of default=noprint_wrappers=1 "$input"
  } >"$report"
}

assert_recognized_gifs() {
  local directory="$1"
  local gif basename
  [[ -d "$directory" ]] || return 0
  while IFS= read -r -d '' gif; do
    basename="$(basename "$gif")"
    case "$basename" in
      episode_0[1-8].gif|episode_0[1-8]_real.gif|episode_0[1-8]_gaussian.gif) ;;
      *)
        echo "Refusing to modify policy-evaluation directory with unexpected file: ${gif}" >&2
        exit 1
        ;;
    esac
  done < <(find "$directory" -maxdepth 1 -type f -print0)
}

remove_recognized_gifs() {
  local directory="$1"
  local index episode
  assert_recognized_gifs "$directory"
  for index in "${!EPISODES[@]}"; do
    episode="$(printf '%02d' "$((index + 1))")"
    rm -f -- "${directory}/episode_${episode}.gif" \
      "${directory}/episode_${episode}_real.gif" \
      "${directory}/episode_${episode}_gaussian.gif"
  done
}

assert_expected_basenames() {
  local directory="$1"
  local label="$2"
  local index episode
  local -a actual expected
  mapfile -t actual < <(find "$directory" -maxdepth 1 -type f -printf '%f\n' | sort)
  for index in "${!EPISODES[@]}"; do
    episode="$(printf '%02d' "$((index + 1))")"
    expected+=("episode_${episode}.gif")
  done
  [[ "${actual[*]}" == "${expected[*]}" ]] || {
    printf 'Unexpected %s GIF list: %s\n' "$label" "${actual[*]}" >&2
    exit 1
  }
}

timeline_rows() {
  awk -F ',' '/^[[:space:]]*[0-9]+,/ {
    for (field = 1; field <= 5; field++) {
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", $field)
    }
    print $1 "," $2 "," $3 "," $4 "," $5
  }' "$1"
}

assert_timeline_ordinal() {
  local timeline="$1"
  local require_normalized_tick="$2"
  local rows
  rows="$(timeline_rows "$timeline")"
  [[ "$(printf '%s\n' "$rows" | sed '/^$/d' | wc -l)" == '140' ]] || {
    echo "Expected 140 framemd5 rows in ${timeline}." >&2
    exit 1
  }
  printf '%s\n' "$rows" | awk -F ',' -v normalized="$require_normalized_tick" '
    {
      ordinal = NR - 1
      if ($2 != ordinal || $3 != ordinal || $4 <= 0 || (normalized == "yes" && $4 != 1)) exit 1
    }
    NR == 1 {
      previous_pts = $3
      next
    }
    {
      if ($3 <= previous_pts || $4 <= 0) exit 1
      if (normalized == "yes" && $4 != 1) exit 1
      previous_pts = $3
    }
    END { if (NR != 140) exit 1 }
  ' || {
    echo "Invalid frame ordinal timing in ${timeline}." >&2
    exit 1
  }
}

generate_timeline() {
  local real_input="$1"
  local gaussian_input="$2"
  local real_timeline="$3"
  local gaussian_timeline="$4"
  local real_filter gaussian_filter
  real_filter='[0:v]setpts=PTS-STARTPTS,fps=fps=6:start_time=0:round=near,scale=320:180:flags=lanczos,setsar=1,settb=AVTB,setpts=N/(6*TB)[real]'
  gaussian_filter='[0:v]setpts=PTS-STARTPTS,crop=1280:720:0:0,fps=fps=6:start_time=0:round=near,scale=320:180:flags=lanczos,setsar=1,settb=AVTB,setpts=N/(6*TB)[sim]'
  ffmpeg -hide_banner -loglevel error -y -i "$real_input" -filter_complex "$real_filter" -map '[real]' -f framemd5 "$real_timeline"
  ffmpeg -hide_banner -loglevel error -y -i "$gaussian_input" -filter_complex "$gaussian_filter" -map '[sim]' -f framemd5 "$gaussian_timeline"
  assert_timeline_ordinal "$real_timeline" yes
  assert_timeline_ordinal "$gaussian_timeline" yes
  diff -u <(timeline_rows "$real_timeline") <(timeline_rows "$gaussian_timeline") >/dev/null || {
    echo "Real and Sim timeline timing fields differ for ${real_timeline}." >&2
    exit 1
  }
}

generate_gif() {
  local real_input="$1"
  local gaussian_input="$2"
  local output="$3"
  local log="$4"
  local filter
  filter='[0:v]setpts=PTS-STARTPTS,fps=fps=6:start_time=0:round=near,scale=320:180:flags=lanczos,setsar=1,settb=AVTB,setpts=N/(6*TB)[real];[1:v]setpts=PTS-STARTPTS,crop=1280:720:0:0,fps=fps=6:start_time=0:round=near,scale=320:180:flags=lanczos,setsar=1,settb=AVTB,setpts=N/(6*TB)[sim];[real][sim]hstack=inputs=2:shortest=1,split[frames][palette_source];[palette_source]palettegen=max_colors=128:stats_mode=diff[palette];[frames][palette]paletteuse=dither=sierra2_4a:diff_mode=rectangle[out]'
  ffmpeg -hide_banner -loglevel error -y -i "$real_input" -i "$gaussian_input" \
    -filter_complex "$filter" -map '[out]' -loop 0 "$output" >"$log" 2>&1
}

validate_gif() {
  local gif="$1"
  local width height rate frames duration timeline
  width="$(probe_value "$gif" width)"
  height="$(probe_value "$gif" height)"
  rate="$(probe_value "$gif" avg_frame_rate)"
  frames="$(probe_value "$gif" nb_read_frames)"
  duration="$(format_duration "$gif")"
  [[ -s "$gif" && "$width" == '640' && "$height" == '180' && "$rate" == '6/1' && "$frames" == '140' ]] || {
    echo "Invalid combined GIF metadata for ${gif}." >&2
    exit 1
  }
  assert_approx "$duration" 23.34 0.01
  identify -verbose "${gif}[0]" | grep -q 'Iterations: 0' || {
    echo "Combined GIF does not loop infinitely: ${gif}" >&2
    exit 1
  }
  timeline="$(mktemp "${OUTPUT_ROOT}/combined-timeline.XXXXXX")"
  ffmpeg -hide_banner -loglevel error -y -i "$gif" -f framemd5 "$timeline"
  assert_timeline_ordinal "$timeline" no
  rm -f -- "$timeline"
}

generate_contact_sheet() {
  local gif="$1"
  local output="$2"
  local scratch_dir
  scratch_dir="$(mktemp -d "${OUTPUT_ROOT}/coalesced-frames.XXXXXX")"
  convert "$gif" -coalesce "${scratch_dir}/frame_%03d.png"
  [[ "$(find "$scratch_dir" -maxdepth 1 -type f -name 'frame_*.png' | wc -l)" == '140' ]] || {
    echo "Unexpected coalesced frame count for ${gif}." >&2
    rm -rf -- "$scratch_dir"
    exit 1
  }
  identify "${scratch_dir}/frame_000.png" | grep -q '640x180' || {
    echo "Unexpected coalesced frame geometry for ${gif}." >&2
    rm -rf -- "$scratch_dir"
    exit 1
  }
  convert "${scratch_dir}/frame_000.png" "${scratch_dir}/frame_046.png" \
    "${scratch_dir}/frame_093.png" "${scratch_dir}/frame_139.png" +append "$output"
  rm -rf -- "$scratch_dir"
}

require_command ffmpeg
require_command ffprobe
require_command sha256sum
require_command convert
require_command identify

# Validate every source before replacing any staged or published asset.
for index in "${!EPISODES[@]}"; do
  IFS='|' read -r directory real_name gaussian_name <<<"${EPISODES[$index]}"
  real_input="${SOURCE_ROOT}/${directory}/${real_name}"
  gaussian_input="${SOURCE_ROOT}/${directory}/${gaussian_name}"
  [[ "$real_input" != *video_simulated_twin.mp4 && "$gaussian_input" != *video_simulated_twin.mp4 ]] || {
    echo 'video_simulated_twin.mp4 is not an allowed input.' >&2
    exit 1
  }
  [[ -f "$real_input" && -f "$gaussian_input" ]] || {
    echo "Missing manifest input for episode $(printf '%02d' "$((index + 1))")." >&2
    exit 1
  }
  assert_source "$real_input" 1280 720
  assert_source "$gaussian_input" 2560 720
done

mkdir -p "$GENERATED_DIR" "$CONTACT_SHEETS_DIR" "$PROBES_DIR" "$LOGS_DIR"
find "$OUTPUT_ROOT" -maxdepth 1 -type f -name 'combined-timeline.*' -delete
remove_recognized_gifs "$GENERATED_DIR"
for index in "${!EPISODES[@]}"; do
  episode_number="$(printf '%02d' "$((index + 1))")"
  rm -f -- "${PROBES_DIR}/episode_${episode_number}_real_output.txt" \
    "${PROBES_DIR}/episode_${episode_number}_gaussian_output.txt" \
    "${PROBES_DIR}/episode_${episode_number}_output.txt" \
    "${PROBES_DIR}/episode_${episode_number}_real_timeline.framemd5" \
    "${PROBES_DIR}/episode_${episode_number}_gaussian_timeline.framemd5" \
    "${LOGS_DIR}/episode_${episode_number}.log" \
    "${LOGS_DIR}/episode_${episode_number}_real.log" \
    "${LOGS_DIR}/episode_${episode_number}_gaussian.log"
done

for index in "${!EPISODES[@]}"; do
  IFS='|' read -r directory real_name gaussian_name <<<"${EPISODES[$index]}"
  episode_number="$(printf '%02d' "$((index + 1))")"
  real_input="${SOURCE_ROOT}/${directory}/${real_name}"
  gaussian_input="${SOURCE_ROOT}/${directory}/${gaussian_name}"
  gif="${GENERATED_DIR}/episode_${episode_number}.gif"

  write_probe_report "$real_input" "${PROBES_DIR}/episode_${episode_number}_real_source.txt"
  write_probe_report "$gaussian_input" "${PROBES_DIR}/episode_${episode_number}_gaussian_source.txt"
  generate_timeline "$real_input" "$gaussian_input" \
    "${PROBES_DIR}/episode_${episode_number}_real_timeline.framemd5" \
    "${PROBES_DIR}/episode_${episode_number}_gaussian_timeline.framemd5"
  generate_gif "$real_input" "$gaussian_input" "$gif" "${LOGS_DIR}/episode_${episode_number}.log"
  validate_gif "$gif"
  write_probe_report "$gif" "${PROBES_DIR}/episode_${episode_number}_output.txt"
  generate_contact_sheet "$gif" "${CONTACT_SHEETS_DIR}/episode_${episode_number}.png"
done

assert_expected_basenames "$GENERATED_DIR" generated
convert "${CONTACT_SHEETS_DIR}"/episode_{01..08}.png -append "${CONTACT_SHEETS_DIR}/all_episodes.png"

INSTALL_STAGING_DIR="$(mktemp -d "${OUTPUT_ROOT}/install-staging.XXXXXX")"
for index in "${!EPISODES[@]}"; do
  episode_number="$(printf '%02d' "$((index + 1))")"
  install -m 0644 "${GENERATED_DIR}/episode_${episode_number}.gif" "${INSTALL_STAGING_DIR}/episode_${episode_number}.gif"
done
assert_expected_basenames "$INSTALL_STAGING_DIR" install-staged
cmp <(sha256sum "${GENERATED_DIR}"/*.gif | sed "s#${GENERATED_DIR}#.#") \
  <(sha256sum "${INSTALL_STAGING_DIR}"/*.gif | sed "s#${INSTALL_STAGING_DIR}#.#")

mkdir -p "$FINAL_DIR"
remove_recognized_gifs "$FINAL_DIR"
for index in "${!EPISODES[@]}"; do
  episode_number="$(printf '%02d' "$((index + 1))")"
  install -m 0644 "${INSTALL_STAGING_DIR}/episode_${episode_number}.gif" "${FINAL_DIR}/episode_${episode_number}.gif"
done
assert_expected_basenames "$FINAL_DIR" published
cmp <(sha256sum "${GENERATED_DIR}"/*.gif | sed "s#${GENERATED_DIR}#.#") \
  <(sha256sum "${INSTALL_STAGING_DIR}"/*.gif | sed "s#${INSTALL_STAGING_DIR}#.#")
cmp <(sha256sum "${GENERATED_DIR}"/*.gif | sed "s#${GENERATED_DIR}#.#") \
  <(sha256sum "${FINAL_DIR}"/*.gif | sed "s#${FINAL_DIR}#.#")

total_bytes="$(find "$GENERATED_DIR" -maxdepth 1 -type f -name 'episode_*.gif' -printf '%s\n' | awk '{ total += $1 } END { print total }')"
{
  printf 'total_gif_bytes=%s\n' "$total_bytes"
  printf 'total_gif_mib=%.2f\n' "$(awk "BEGIN { print ${total_bytes} / 1024 / 1024 }")"
  printf 'previous_total_gif_mib=27.72\n'
  printf '[generated]\n'
  sha256sum "$GENERATED_DIR"/*.gif | sed "s#${GENERATED_DIR}#generated#"
  printf '[install-staged]\n'
  sha256sum "$INSTALL_STAGING_DIR"/*.gif | sed "s#${INSTALL_STAGING_DIR}#install-staged#"
  printf '[published]\n'
  sha256sum "$FINAL_DIR"/*.gif | sed "s#${FINAL_DIR}#published#"
} >"${PROBES_DIR}/generated_manifest.txt"

printf 'Generated and installed 8 synchronized policy evaluation GIFs (%.2f MiB total).\n' \
  "$(awk "BEGIN { print ${total_bytes} / 1024 / 1024 }")"
