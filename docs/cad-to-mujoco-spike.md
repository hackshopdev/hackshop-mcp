# CAD to MuJoCo spike

Spec D adds `hackshop_sim.cad.mjcf`, a small build123d-to-MJCF exporter for tree mechanisms. It writes one binary STL mesh per link, emits CAD-derived `<inertial>` blocks when requested, can also let MuJoCo derive inertia from meshes, and includes a deterministic position-servo hold test.

The automated CAD-vs-MuJoCo agreement tests use a closed two-link box mechanism and the real demo arm mesh so MuJoCo's mesh integration is directly comparable to OpenCascade mass properties. The demo arm is exported with exact mesh inertia for the MuJoCo-derived comparison. On the local run, the real holed arm body had 0.00205% mass error, 0.000183 mm max COM error, and 0.00170% max principal-inertia error.

The demo arm is a fixed servo bracket, a printed PLA arm with a hub hole and three lightening holes, and a separate fixed payload body welded at the tip. The arm uses PLA density only; the payload uses its own mass so the torque calculation uses the true mass-weighted COM. For the default 120 mm arm and 50 g payload, required hold torque was 0.068945 N*m.

Servo verdicts:
- SG90: nominal datasheet stall torque at about 4.8 V is 0.18 N*m; margin 2.611; hold result settled at 0.395016 degrees; verdict `holds`.
- MG996R: nominal datasheet stall torque at about 4.8 V is 0.92 N*m; margin 13.344; hold result settled at 0.395016 degrees; verdict `holds`.
- SG90 with 200 g payload: required hold torque was 0.245525 N*m; margin 0.733; hold result settled at 42.834066 degrees with 0.994 saturated fraction; verdict `sags: servo underpowered by 36.4%`.

This unlocks CAD-backed per-link meshes for the viewer, explicit joint frames that agree with physics, and the first articulated `manipulate` slice where a bad servo or long arm visibly sags instead of looking plausible.

Still missing: joint frames are authored by hand rather than read from CAD constraints; there are no simplified collision meshes separate from the visual meshes, and the hold test disables contact; there is no motor speed or torque curve; there is no contact or grasp model; and this is not wired into `/simulate`.
