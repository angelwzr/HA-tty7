"""Synthetic full-name precedence, storage consent and metadata-only refreshes."""
from copy import deepcopy
from datetime import timedelta

import pytest

from test_controller import NOW, inventory
from test_omp_controller import native
from custom_components.ha_tty7.controller import HostController, notification_payload
from custom_components.ha_tty7.protocol import build_error

FULL = "A synthetic session title longer than forty characters — complete ending"
CLIPPED = FULL[:39] + "…"


def named(status="working", name=FULL, **kwargs):
    row = native(status, **kwargs)
    row["omp"]["session_name"] = name
    return row


def section():
    result = inventory()
    result["tabs"][0].update(name=None, label=CLIPPED)
    return result


def accept(controller, row, inv, second=0):
    return controller.accept({"kind": "snapshot", "agents": [row], "inventory": inv},
                             NOW + timedelta(seconds=second))


@pytest.mark.parametrize("explicit,expected", [(None, FULL), ("Chosen tab", "Chosen tab")])
def test_native_full_title_precedence_and_custom_tab_name(explicit, expected):
    controller = HostController("desktop_demo")
    inv = section()
    inv["tabs"][0]["name"] = explicit
    accept(controller, named(), inv)
    events = accept(controller, named("done"), inv, 1)
    assert len(events) == 1
    assert events[0]["session_name"] == expected
    assert events[0]["tab_name"] == explicit
    assert notification_payload("desktop_demo", "Desktop", events[0], "/agents", mobile=True)["title"] == expected


@pytest.mark.parametrize("mutation", ["names", "derived", "missing", "inconsistent", "orphan", "ambiguous", "stale", "unconfirmed"])
def test_unapproved_native_names_never_notify_or_persist(mutation):
    controller = HostController("desktop_demo")
    inv = section()
    if mutation == "names":
        inv["names_included"] = False
    elif mutation == "derived":
        inv["derived_labels_included"] = False
    elif mutation == "missing":
        inv = None
    elif mutation == "inconsistent":
        inv["consistent"] = False
    elif mutation == "orphan":
        inv["panes"][0]["orphan"] = True
    elif mutation == "ambiguous":
        inv["tabs"].append(inv["tabs"][0] | {"tab_id": "another-tab"})
    accept(controller, named(), inv)
    if mutation in ("stale", "unconfirmed"):
        controller.inventory_state = mutation
    events = accept(controller, named("done"), inv, 1)
    assert events[0].get("session_name") != FULL
    if mutation not in ("stale", "unconfirmed"):
        assert FULL not in str(controller.restore_attributes(retain_inventory=True))


@pytest.mark.parametrize("bad", ["", "  ", "x" * 257, "line\nbreak", "bad\x7f", "bad\x85", "\ud800", 3, {}, []])
def test_malformed_native_name_is_not_used_even_at_direct_controller_boundary(bad):
    controller = HostController("desktop_demo")
    inv = section()
    accept(controller, named(name=bad), inv)
    event = accept(controller, named("done", name=bad), inv, 1)[0]
    assert event["session_name"] == CLIPPED


def test_native_name_rename_updates_attributes_without_new_alerts_or_identity():
    controller = HostController("desktop_demo")
    inv = section()
    assert accept(controller, named(), inv) == []
    assert accept(controller, named(name="Renamed complete session"), inv, 1) == []
    assert controller.attributes["agents"][0]["omp"]["session_name"] == "Renamed complete session"
    event = accept(controller, named("done", name="Renamed complete session"), inv, 2)[0]
    assert event["session_name"] == "Renamed complete session"
    assert accept(controller, named("done", name="Renamed after completion"), inv, 3) == []


def test_storage_scrubs_native_names_without_mutating_live_or_older_stored_data():
    controller = HostController("desktop_demo")
    accept(controller, named(), section())
    original = deepcopy(controller.attributes)
    assert FULL not in str(controller.restore_attributes())
    assert controller.attributes == original
    assert FULL in str(controller.restore_attributes(retain_inventory=True))
    restored = HostController("desktop_demo")
    restored.restore(original)
    assert restored.agents and FULL not in str(restored.attributes)
    retained = HostController("desktop_demo")
    retained.restore(original, retain_inventory=True)
    assert retained.agents[0]["omp"]["session_name"] == FULL
    assert retained.state == "unconfirmed" and retained.inventory_state == "unconfirmed"
    assert original == controller.attributes


@pytest.mark.parametrize("retained_inventory", [None, {"kind": "snapshot", "bad": True}])
def test_restore_cannot_retain_native_name_without_valid_inventory(retained_inventory):
    controller = HostController("desktop_demo")
    accept(controller, named(), section())
    restored = HostController("desktop_demo")
    restored.restore(controller.attributes | {"inventory": retained_inventory}, retain_inventory=True)
    assert restored.agents and FULL not in str(restored.attributes)


@pytest.mark.parametrize("error_kind", ["inventory", "roster", "disabled"])
@pytest.mark.parametrize("names,derived", [(False, False), (True, False)])
def test_error_consent_revocation_immediately_scrubs_last_known_native_name(error_kind, names, derived):
    controller = HostController("desktop_demo")
    accept(controller, named(), section())
    if error_kind == "inventory":
        accept(controller, named(), {"kind": "error", "error_code": "cli_failed",
                                    "names_included": names, "derived_labels_included": derived}, 1)
    else:
        controller.accept(build_error("desktop_demo", "cli_failed") | {"inventory_privacy": {
            "enabled": error_kind != "disabled", "names_included": names,
            "derived_labels_included": derived}}, NOW + timedelta(seconds=1))
    assert FULL not in str(controller.attributes)
    assert FULL not in str(controller.restore_attributes(retain_inventory=True))


def test_cached_inventory_cannot_override_name_consent_revocation():
    controller = HostController("desktop_demo")
    inv = section()
    accept(controller, named(), inv)
    revoked = deepcopy(inv)
    revoked["derived_labels_included"] = False
    accept(controller, named(), revoked, 1)
    assert FULL not in str(controller.attributes)
    assert controller.inventory_last_success == NOW


@pytest.mark.parametrize("name", [None, ""])
def test_missing_full_name_keeps_the_source_label_without_inventing_a_suffix(name):
    controller = HostController("desktop_demo")
    inv = section()
    accept(controller, named(name=name), inv)
    event = accept(controller, named("done", name=name), inv, 1)[0]
    assert event["session_name"] == CLIPPED


def test_nonready_native_source_cannot_retain_a_stale_full_name():
    controller = HostController("desktop_demo")
    assert accept(controller, named(state="stale"), section()) == []
    assert FULL not in str(controller.attributes)
    assert controller.agents[0]["omp"]["state"] == "stale"
