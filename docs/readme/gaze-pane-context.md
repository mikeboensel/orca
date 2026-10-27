# Gaze to Orca pane context

Orca Fork can resolve a desktop gaze point against its own rendered pane layout. It returns stable worktree, group, active tab, and terminal leaf IDs plus the exact bounds used for the hit. The lookup does not need Accessibility permission because Orca owns these DOM elements.

## Commands

```sh
orca gaze resolve --x 900 --y 500 --json
orca gaze resolve --x 900 --y 500 --highlight
orca gaze resolve --x 900 --y 500 --debug --json
orca gaze clear
orca gaze follow --debug --json
```

`resolve` accepts desktop logical points with a top-left origin, matching Gaze Probe's `position.globalQuartzPoints`. `--highlight` outlines the matched leaf or group inside Orca. A miss clears the outline when `--highlight` is present. Without it, `resolve` is read-only. `clear` removes the outline. The `--json` reply includes `pane.worktreeId`, `groupId`, `tabId`, `contentType`, `leafId`, and `bounds`; `pane` is `null` outside a rendered pane.

`--debug` includes the outline, a marker at the estimated point, and a small label showing the resolved group, tab, and leaf IDs. Compare that marker with the outlined pane and the CLI JSON output to diagnose a wrong hit. The marker is removed by `gaze clear` or when `follow` stops.

`follow` subscribes to Gaze Probe at `http://127.0.0.1:48765/events`, uses only snapshots with `state: "tracked"`, resolves each primary gaze point, and prints a line when the identified pane changes. It clears the outline when tracking stops, the point leaves Orca, or the command ends. It reconnects if the stream drops. Gaze Probe must be running and its cameras enabled. `follow` is an explicit long-running CLI command; it does not start Gaze Probe or the cameras.

The main process converts desktop points to renderer CSS coordinates using the window content bounds and zoom factor. The renderer finds the live `data-tab-group-body-id` and `data-worktree-id` at that point, then reads the active tab from Orca's state. Terminal leaves are retained outside the group DOM, so it locates the active tab's `data-terminal-overlay-tab-id` and hits its `data-leaf-id` elements. The returned bounds are converted back to desktop logical points.

This is a geometry lookup inside Orca's own window. It does not establish whether another app covers that window or whether gaze implies user intent. A client that needs topmost-window certainty should first select the window through CoreGraphics, then call `gaze.resolve` for points within Orca. The highlight is only a visual cue; it never changes keyboard focus or the selected tab.

## Prior art and interaction model

- [macOS Head Pointer](https://support.apple.com/en-gb/guide/mac-help/mchlb2d4782b/27/mac/27) uses a camera to move the pointer from face or head movement. It provides a pause control and an explicit recalibration action. It tracks head movement rather than estimating eye gaze.
- [macOS Dwell](https://support.apple.com/en-gb/guide/mac-help/mchl437b47b0/27/mac/27) lets users perform pointer actions after remaining at a target with eye or head tracking. This separates an estimated target from an intentional action.
- [WebGazer](https://webgazer.cs.brown.edu/) estimates gaze coordinates from an ordinary webcam and exposes a continuous stream of viewport positions. It can calibrate from clicks and cursor movement.
- [Windows Eye Control](https://support.microsoft.com/en-us/accessibility/windows/eye-control/eye-control-basics-in-windows) uses a supported eye tracker and offers a gaze cursor with dwell based actions.
- [MacGaze](https://github.com/AACTools/MacGaze) is a small native Swift webcam gaze project with a Core ML model and calibration correction; its pipeline is useful to inspect for Gaze Probe.
- [Eye Tracker](https://github.com/bugraskl/eye-tracker) is a small cross-platform webcam project for switching between monitors. Its dwell, hysteresis, and typing or mouse guards are useful examples for any future focus action.

For Orca, the gaze point is a candidate for visual context, not an instruction to select a tab or move keyboard focus. The debug marker shows the input point, while the outline shows the pane derived from Orca's live layout. A consumer that acts on a pane should add its own time threshold or hysteresis and preserve a separate `unknown` state when tracking is uncertain.
