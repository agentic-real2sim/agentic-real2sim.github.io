"""Render USD animations to consistently framed GIFs with Omniverse Kit RTX."""

import asyncio
import json
import math
import os
import shutil
import subprocess
import traceback
from itertools import product
from pathlib import Path

import carb
import omni.kit.app
import omni.kit.async_engine
import omni.timeline
import omni.usd
from omni.kit.viewport.utility import (
    capture_viewport_to_file,
    get_active_viewport,
    next_viewport_frame_async,
)
from pxr import Gf, Sdf, Usd, UsdGeom


INPUT_DIR = Path(os.environ["USD_GIF_INPUT_DIR"])
OUTPUT_DIR = Path(os.environ["USD_GIF_OUTPUT_DIR"])
START_INDEX = int(os.environ.get("USD_GIF_START_INDEX", "0"))
LIMIT = int(os.environ.get("USD_GIF_LIMIT", "0"))

WIDTH = 640
HEIGHT = 480
SOURCE_FPS = 60
GIF_FPS = 12
TIMECODE_STEP = SOURCE_FPS // GIF_FPS
FRAME_OCCUPANCY = float(os.environ.get("USD_GIF_FRAME_OCCUPANCY", "0.75"))
CAMERA_DISTANCE_MARGIN = float(os.environ.get("USD_GIF_CAMERA_DISTANCE_MARGIN", "1.05"))
DYNAMIC_CAMERA = bool(int(os.environ.get("USD_GIF_DYNAMIC_CAMERA", "0")))

HORIZONTAL_APERTURE = 36.0
VERTICAL_APERTURE = HORIZONTAL_APERTURE * HEIGHT / WIDTH
FOCAL_LENGTH = 35.0
CAMERA_DIRECTION = Gf.Vec3d(1.2, -1.6, 1.0).GetNormalized()
WORLD_UP = Gf.Vec3d(0.0, 0.0, 1.0)
CAMERA_PATH = Sdf.Path("/__CodexRenderCamera")
FFMPEG = "/usr/bin/ffmpeg"


def log(message):
    print(f"[USD-GIF] {message}", flush=True)
    carb.log_info(f"[USD-GIF] {message}")


def hide_viewport_guides(viewport):
    settings = carb.settings.get_settings()
    viewport_prefix = f"/persistent/app/viewport/{viewport.id}"
    for item in (
        "guide/grid",
        "guide/axis",
        "guide/selection",
        "guide/boundingBox",
        "scene/cameras",
        "scene/lights",
        "scene/skeletons",
    ):
        settings.set(f"{viewport_prefix}/{item}/visible", False)


def relevant_meshes(stage):
    meshes = []
    purposes = [UsdGeom.Tokens.default_, UsdGeom.Tokens.render, UsdGeom.Tokens.proxy]
    cache = UsdGeom.BBoxCache(Usd.TimeCode(stage.GetStartTimeCode()), purposes, useExtentsHint=False)
    for prim in stage.Traverse():
        if not prim.IsA(UsdGeom.Mesh):
            continue
        path_lower = str(prim.GetPath()).lower()
        if "ground" in path_lower or "floor" in path_lower:
            continue
        initial_range = cache.ComputeWorldBound(prim).ComputeAlignedRange()
        if not initial_range.IsEmpty():
            dimensions = sorted(abs(float(value)) for value in initial_range.GetSize())
            is_slender_scene_artifact = dimensions[2] > 2.0 and dimensions[2] / max(dimensions[1], 1e-6) > 12.0
            if is_slender_scene_artifact:
                log(f"excluding slender scene artifact {prim.GetPath()} with dimensions {dimensions}")
                continue
        meshes.append(prim)
    assert meshes, "Stage has no non-ground meshes"
    return meshes


def animation_timecodes(stage):
    start = int(math.ceil(stage.GetStartTimeCode()))
    end_exclusive = int(math.ceil(stage.GetEndTimeCode()))
    assert start == 0, f"Expected animation to start at timecode 0, got {start}"
    assert end_exclusive > start, "Stage has no animation range"
    return list(range(start, end_exclusive, TIMECODE_STEP))


def bounds_by_timecode(stage, meshes, timecodes):
    bounds = []
    aggregate = Gf.Range3d()
    purposes = [UsdGeom.Tokens.default_, UsdGeom.Tokens.render, UsdGeom.Tokens.proxy]
    cache = UsdGeom.BBoxCache(Usd.TimeCode(timecodes[0]), purposes, useExtentsHint=False)

    for timecode in timecodes:
        current = Gf.Range3d()
        cache.SetTime(Usd.TimeCode(timecode))
        for prim in meshes:
            visibility = UsdGeom.Imageable(prim).ComputeVisibility(Usd.TimeCode(timecode))
            if visibility == UsdGeom.Tokens.invisible:
                continue
            world_range = cache.ComputeWorldBound(prim).ComputeAlignedRange()
            if not world_range.IsEmpty():
                current.UnionWith(world_range)
                aggregate.UnionWith(world_range)
        assert not current.IsEmpty(), f"Relevant meshes have empty bounds at timecode {timecode}"
        bounds.append(current)

    assert not aggregate.IsEmpty(), "Relevant meshes have empty animated bounds"
    return bounds, aggregate


def camera_transform(bounds):
    minimum = bounds.GetMin()
    maximum = bounds.GetMax()
    center = (minimum + maximum) * 0.5
    corners = [Gf.Vec3d(x, y, z) for x, y, z in product(
        (minimum[0], maximum[0]),
        (minimum[1], maximum[1]),
        (minimum[2], maximum[2]),
    )]

    forward = -CAMERA_DIRECTION
    right = Gf.Cross(forward, WORLD_UP).GetNormalized()
    camera_up = Gf.Cross(right, forward).GetNormalized()
    half_horizontal_fov = math.atan(HORIZONTAL_APERTURE / (2.0 * FOCAL_LENGTH))
    half_vertical_fov = math.atan(VERTICAL_APERTURE / (2.0 * FOCAL_LENGTH))
    horizontal_limit = FRAME_OCCUPANCY * math.tan(half_horizontal_fov)
    vertical_limit = FRAME_OCCUPANCY * math.tan(half_vertical_fov)

    distance = 0.0
    for corner in corners:
        offset = corner - center
        near_shift = Gf.Dot(offset, CAMERA_DIRECTION)
        distance = max(
            distance,
            near_shift + abs(Gf.Dot(offset, right)) / horizontal_limit,
            near_shift + abs(Gf.Dot(offset, camera_up)) / vertical_limit,
        )

    distance *= CAMERA_DISTANCE_MARGIN
    assert distance > 0.0, "Computed camera distance is invalid"
    eye = center + CAMERA_DIRECTION * distance
    transform = Gf.Matrix4d(1.0).SetLookAt(eye, center, WORLD_UP).GetInverse()
    return center, eye, distance, transform


def install_camera(stage, transform):
    stage.SetEditTarget(stage.GetSessionLayer())
    camera = UsdGeom.Camera.Define(stage, CAMERA_PATH)
    camera.GetProjectionAttr().Set(UsdGeom.Tokens.perspective)
    camera.GetHorizontalApertureAttr().Set(HORIZONTAL_APERTURE)
    camera.GetVerticalApertureAttr().Set(VERTICAL_APERTURE)
    camera.GetFocalLengthAttr().Set(FOCAL_LENGTH)
    camera.GetClippingRangeAttr().Set(Gf.Vec2f(0.001, 1_000_000.0))

    xformable = UsdGeom.Xformable(camera.GetPrim())
    xformable.ClearXformOpOrder()
    transform_op = xformable.AddTransformOp()
    transform_op.Set(transform)
    return transform_op


def encode_gif(frame_dir, output_path):
    palette_path = frame_dir / "palette.png"
    input_pattern = str(frame_dir / "frame_%06d.png")
    subprocess.run(
        [
            FFMPEG,
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-framerate",
            str(GIF_FPS),
            "-i",
            input_pattern,
            "-vf",
            "palettegen=stats_mode=diff",
            str(palette_path),
        ],
        check=True,
    )
    subprocess.run(
        [
            FFMPEG,
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-framerate",
            str(GIF_FPS),
            "-i",
            input_pattern,
            "-i",
            str(palette_path),
            "-lavfi",
            "paletteuse=dither=sierra2_4a",
            "-loop",
            "0",
            str(output_path),
        ],
        check=True,
    )
    assert output_path.is_file() and output_path.stat().st_size > 0


async def render_usd(context, timeline, viewport, usd_path, output_path):
    success, error = await context.open_stage_async(str(usd_path))
    assert success, f"Could not open {usd_path}: {error}"
    stage = context.get_stage()
    assert stage
    assert round(stage.GetTimeCodesPerSecond()) == SOURCE_FPS

    timecodes = animation_timecodes(stage)
    meshes = relevant_meshes(stage)
    frame_bounds, bounds = bounds_by_timecode(stage, meshes, timecodes)
    if DYNAMIC_CAMERA:
        camera_states = [camera_transform(current_bounds) for current_bounds in frame_bounds]
    else:
        camera_state = camera_transform(bounds)
        camera_states = [camera_state] * len(timecodes)
    center, eye, distance, transform = camera_states[0]
    camera_transform_op = install_camera(stage, transform)
    camera_distances = [state[2] for state in camera_states]

    viewport.fill_frame = False
    viewport.resolution = (WIDTH, HEIGHT)
    viewport.camera_path = str(CAMERA_PATH)
    timeline.set_auto_update(False)
    timeline.set_time_codes_per_second(SOURCE_FPS)
    timeline.set_current_time(timecodes[0] / SOURCE_FPS)

    for _ in range(12):
        await next_viewport_frame_async(viewport)

    frame_dir = OUTPUT_DIR / ".frames" / usd_path.stem
    if frame_dir.exists():
        shutil.rmtree(frame_dir)
    frame_dir.mkdir(parents=True)

    log(
        f"{usd_path.name}: {len(meshes)} relevant meshes, "
        f"{len(timecodes)} GIF frames, camera distance "
        f"{min(camera_distances):.3f}-{max(camera_distances):.3f}, "
        f"dynamic={DYNAMIC_CAMERA}, occupancy={FRAME_OCCUPANCY:.2f}"
    )
    for output_index, timecode in enumerate(timecodes):
        center, eye, distance, transform = camera_states[output_index]
        camera_transform_op.Set(transform)
        timeline.set_current_time(timecode / SOURCE_FPS)
        await next_viewport_frame_async(viewport)
        frame_path = frame_dir / f"frame_{output_index:06d}.png"
        capture = capture_viewport_to_file(viewport, file_path=str(frame_path))
        captured = await capture.wait_for_result(completion_frames=1)
        assert captured, f"Capture failed at timecode {timecode}"
        if output_index % 60 == 0 or output_index + 1 == len(timecodes):
            log(f"{usd_path.name}: captured {output_index + 1}/{len(timecodes)}")

    encode_gif(frame_dir, output_path)
    shutil.rmtree(frame_dir)
    metadata = {
        "source": str(usd_path),
        "output": str(output_path),
        "width": WIDTH,
        "height": HEIGHT,
        "fps": GIF_FPS,
        "source_fps": SOURCE_FPS,
        "frame_count": len(timecodes),
        "duration_seconds": len(timecodes) / GIF_FPS,
        "relevant_mesh_count": len(meshes),
        "bounds_min": list(bounds.GetMin()),
        "bounds_max": list(bounds.GetMax()),
        "camera_center": list(center),
        "camera_eye": list(eye),
        "camera_distance": distance,
        "camera_distance_min": min(camera_distances),
        "camera_distance_max": max(camera_distances),
        "dynamic_camera": DYNAMIC_CAMERA,
        "target_frame_occupancy": FRAME_OCCUPANCY,
        "camera_distance_margin": CAMERA_DISTANCE_MARGIN,
    }
    metadata_path = OUTPUT_DIR / f"{usd_path.stem}.json"
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    log(f"completed {output_path.name} ({output_path.stat().st_size / 1024 / 1024:.1f} MiB)")


async def main():
    assert SOURCE_FPS % GIF_FPS == 0
    assert 0.0 < FRAME_OCCUPANCY < 1.0
    assert CAMERA_DISTANCE_MARGIN >= 1.0
    assert INPUT_DIR.is_dir(), INPUT_DIR
    assert Path(FFMPEG).is_file(), FFMPEG
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    usd_paths = sorted(INPUT_DIR.glob("*.usd"))
    assert len(usd_paths) == 26, f"Expected 26 USDs, found {len(usd_paths)}"
    selected = usd_paths[START_INDEX:]
    if LIMIT > 0:
        selected = selected[:LIMIT]
    assert selected, "No USD files selected"

    app = omni.kit.app.get_app()
    context = omni.usd.get_context()
    timeline = omni.timeline.get_timeline_interface()
    viewport = get_active_viewport()
    assert viewport, "No active viewport"
    hide_viewport_guides(viewport)

    log(f"rendering {len(selected)} of {len(usd_paths)} USDs to {OUTPUT_DIR}")
    for batch_index, usd_path in enumerate(selected, start=START_INDEX + 1):
        output_path = OUTPUT_DIR / f"{usd_path.stem}.gif"
        if output_path.is_file() and output_path.stat().st_size > 0:
            log(f"skipping existing {output_path.name}")
            continue
        log(f"scene {batch_index}/26: {usd_path.name}")
        await render_usd(context, timeline, viewport, usd_path, output_path)

    context.close_stage()
    log("all selected scenes completed")
    app.post_uncancellable_quit(0)


async def run_and_report():
    try:
        await main()
    except Exception:
        traceback.print_exc()
        omni.kit.app.get_app().post_uncancellable_quit(1)


omni.kit.async_engine.run_coroutine(run_and_report())
