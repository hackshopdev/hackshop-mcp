from pathlib import Path

import pytest

bd = pytest.importorskip("build123d")
mujoco = pytest.importorskip("mujoco")

from hackshop_sim.cad.mjcf import (
    Actuator,
    Joint,
    Link,
    Mechanism,
    demo_arm,
    export_mjcf,
    mass_properties,
    required_hold_torque,
    run_hold_test,
)


PLA_DENSITY = 1240.0


def _body_id(model, name: str) -> int:
    return mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_BODY, name)


def _box_mechanism(stall_torque_nm: float = 0.2) -> Mechanism:
    base = bd.Box(30, 20, 10).moved(bd.Pos(0, 0, 5))
    arm = bd.Box(80, 12, 8).moved(bd.Pos(40, 0, 0))
    return Mechanism(
        name="box_arm",
        links=[
            Link("base", base, density_kg_m3=PLA_DENSITY),
            Link("arm", arm, density_kg_m3=PLA_DENSITY),
        ],
        joints=[
            Joint(
                name="shoulder",
                parent="base",
                child="arm",
                type="hinge",
                pos_mm=(0, 0, 10),
                axis=(0, 1, 0),
                range=(-90, 90),
            )
        ],
        actuators=[Actuator("shoulder", kp=10.0, kv=0.3, force_limit=stall_torque_nm)],
    )


def test_export_mjcf_writes_loadable_scene_with_meshes(tmp_path):
    mech = _box_mechanism()
    result = export_mjcf(mech, tmp_path)
    model = mujoco.MjModel.from_xml_path(result["xml"])

    assert model.nbody == len(mech.links) + 1
    assert model.njnt == 1
    assert model.nu == 1
    assert Path(result["xml"]).exists()
    assert sorted(result["meshes"]) == ["arm", "base"]
    for mesh_path in result["meshes"].values():
        assert Path(mesh_path).exists()
        assert Path(mesh_path).stat().st_size > 0


def test_export_mjcf_supports_world_parent_joint(tmp_path):
    arm = bd.Box(40, 10, 8).moved(bd.Pos(20, 0, 0))
    mech = Mechanism(
        name="world_joint",
        links=[Link("arm", arm, density_kg_m3=PLA_DENSITY)],
        joints=[
            Joint(
                name="shoulder",
                parent="world",
                child="arm",
                type="hinge",
                pos_mm=(0, 0, 20),
                axis=(0, 1, 0),
                range=(-45, 45),
            )
        ],
        actuators=[Actuator("shoulder", force_limit=0.1)],
    )

    result = export_mjcf(mech, tmp_path)
    model = mujoco.MjModel.from_xml_path(result["xml"])

    assert model.nbody == 2
    assert model.njnt == 1
    assert model.nu == 1


def test_export_mjcf_supports_fixed_child_without_joint_or_actuator(tmp_path):
    base = bd.Box(20, 20, 10).moved(bd.Pos(0, 0, 5))
    payload = bd.Box(10, 10, 10)
    mech = Mechanism(
        name="fixed_child",
        links=[
            Link("base", base, density_kg_m3=PLA_DENSITY),
            Link("payload", payload, mass_kg=0.05),
        ],
        joints=[
            Joint(
                name="payload_weld",
                parent="base",
                child="payload",
                type="fixed",
                pos_mm=(40, 0, 0),
                axis=(0, 1, 0),
                range=None,
            )
        ],
        actuators=[],
    )

    result = export_mjcf(mech, tmp_path)
    model = mujoco.MjModel.from_xml_path(result["xml"])

    assert model.nbody == 3
    assert model.njnt == 0
    assert model.nu == 0
    payload_id = _body_id(model, "payload")
    assert model.body_pos[payload_id] == pytest.approx((0.04, 0.0, 0.0))


def test_cad_mass_properties_agree_with_mujoco_mesh_integration(tmp_path):
    mech = _box_mechanism()
    cad = export_mjcf(mech, tmp_path / "cad", inertia_source="cad")
    from_geom = export_mjcf(mech, tmp_path / "mujoco", inertia_source="mujoco")

    cad_model = mujoco.MjModel.from_xml_path(cad["xml"])
    geom_model = mujoco.MjModel.from_xml_path(from_geom["xml"])

    for link in mech.links:
        cad_id = _body_id(cad_model, link.name)
        geom_id = _body_id(geom_model, link.name)
        assert cad_model.body_mass[cad_id] == pytest.approx(geom_model.body_mass[geom_id], rel=0.01)
        assert cad_model.body_ipos[cad_id] == pytest.approx(geom_model.body_ipos[geom_id], abs=0.0005)
        assert cad_model.body_inertia[cad_id] == pytest.approx(geom_model.body_inertia[geom_id], rel=0.03)


def test_demo_arm_cad_mass_properties_agree_with_mujoco_mesh_integration(tmp_path):
    mech = demo_arm(link_length_mm=120, payload_g=50, stall_torque_nm=0.2)
    cad = export_mjcf(mech, tmp_path / "cad", inertia_source="cad")
    from_geom = export_mjcf(mech, tmp_path / "mujoco", inertia_source="mujoco")

    cad_model = mujoco.MjModel.from_xml_path(cad["xml"])
    geom_model = mujoco.MjModel.from_xml_path(from_geom["xml"])

    cad_id = _body_id(cad_model, "arm")
    geom_id = _body_id(geom_model, "arm")
    assert cad_model.body_mass[cad_id] == pytest.approx(geom_model.body_mass[geom_id], rel=0.01)
    assert cad_model.body_ipos[cad_id] == pytest.approx(geom_model.body_ipos[geom_id], abs=0.0005)
    assert cad_model.body_inertia[cad_id] == pytest.approx(geom_model.body_inertia[geom_id], rel=0.03)


def test_demo_arm_payload_is_fixed_tip_link_and_torque_matches_hand_estimate(tmp_path):
    payload_g = 50
    link_length_mm = 120
    mech = demo_arm(link_length_mm=link_length_mm, payload_g=payload_g, stall_torque_nm=0.2)
    result = export_mjcf(mech, tmp_path)
    model = mujoco.MjModel.from_xml_path(result["xml"])

    assert [link.name for link in mech.links] == ["bracket", "arm", "payload"]
    assert model.nbody == 4
    assert model.njnt == 1
    assert model.nu == 1

    arm = next(link for link in mech.links if link.name == "arm")
    arm_props = mass_properties(arm)
    hand_estimate = (
        arm_props["mass_kg"] * 9.81 * arm_props["com_m"][0]
        + (payload_g / 1000.0) * 9.81 * (link_length_mm / 1000.0)
    )

    assert required_hold_torque(mech, "shoulder", angle_deg=0.0) == pytest.approx(hand_estimate, rel=0.10)
    assert required_hold_torque(mech, "shoulder", angle_deg=0.0) == pytest.approx(0.07, rel=0.20)


def test_hold_test_separates_oversized_and_underpowered_servos(tmp_path):
    baseline = demo_arm(link_length_mm=120, payload_g=50, stall_torque_nm=1.0)
    required = required_hold_torque(baseline, "shoulder", angle_deg=0.0)

    strong = demo_arm(link_length_mm=120, payload_g=50, stall_torque_nm=2.0 * required)
    strong_xml = export_mjcf(strong, tmp_path / "strong")["xml"]
    strong_result = run_hold_test(strong_xml, target_deg=0.0, seconds=2.0)
    assert abs(strong_result["settle_err_deg"]) <= 3.0

    weak = demo_arm(link_length_mm=120, payload_g=50, stall_torque_nm=0.5 * required)
    weak_xml = export_mjcf(weak, tmp_path / "weak")["xml"]
    weak_result = run_hold_test(weak_xml, target_deg=0.0, seconds=2.0)
    assert abs(weak_result["final_deg"]) > 30.0


def test_joint_range_limit_clamps_overlarge_command(tmp_path):
    mech = demo_arm(link_length_mm=120, payload_g=50, stall_torque_nm=1.0)
    xml = export_mjcf(mech, tmp_path)["xml"]

    result = run_hold_test(xml, target_deg=120.0, seconds=2.0)

    assert result["final_deg"] <= 91.0
    assert result["max_deg"] <= 91.0


def test_hold_test_is_deterministic(tmp_path):
    mech = demo_arm(link_length_mm=120, payload_g=50, stall_torque_nm=0.2)
    xml = export_mjcf(mech, tmp_path)["xml"]

    first = run_hold_test(xml, target_deg=0.0, seconds=2.0)
    second = run_hold_test(xml, target_deg=0.0, seconds=2.0)

    assert first["final_deg"] == second["final_deg"]


def test_demo_arm_units_match_pla_volume_plus_payload():
    payload_g = 50
    mech = demo_arm(link_length_mm=120, payload_g=payload_g, stall_torque_nm=0.2)
    printed_arm = next(link for link in mech.links if link.name == "arm")
    payload = next(link for link in mech.links if link.name == "payload")
    props = mass_properties(printed_arm)
    expected_kg = float(printed_arm.part.volume) * 1e-9 * PLA_DENSITY

    assert props["mass_kg"] == pytest.approx(expected_kg, rel=0.005)
    assert mass_properties(payload)["mass_kg"] == pytest.approx(payload_g / 1000)
