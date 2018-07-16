import frappe
from frappe import _
from frappe.model.mapper import get_mapped_doc, map_child_doc


def match_existing_serial_no(doc, method):
	if not doc.unlinked_serial_no:
		return

	if frappe.db.exists("Serial No", doc.unlinked_serial_no):
		doc.serial_no = doc.unlinked_serial_no


@frappe.whitelist()
def make_quotation(source_name, target_doc=None):
	def set_missing_values(source, target):
		target.order_type = "Maintenance"

	return make_mapped_doc("Quotation", source_name, target_doc, postprocess=set_missing_values)


@frappe.whitelist()
def make_stock_entry(source_name, target_doc=None):
	def set_missing_values(source, target):
		target.purpose = "Material Receipt"
		target.to_warehouse = frappe.db.get_single_value("Repair Settings", "default_incoming_warehouse")

	def _set_child_fields(source_doc, target_doc, source_parent):
		target_doc.update({
			"qty": 1,
			"uom": frappe.db.get_value("Item", source_doc.item_code, "stock_uom"),
			"serial_no": source_doc.serial_no
		})

	target_doc = make_mapped_doc("Stock Entry", source_name, target_doc, postprocess=set_missing_values)

	source_doc = frappe.get_doc("Warranty Claim", source_name)
	if source_doc.get("item_code"):
		table_map = {
			"doctype": "Stock Entry Detail",
			"postprocess": _set_child_fields
		}
		map_child_doc(source_doc, target_doc, table_map, source_doc)

	return target_doc


@frappe.whitelist()
def make_production_order(source_name, target_doc=None):
	def set_missing_values(source, target):
		target.qty = 1
		target.serial_number = source.serial_no or source.unlinked_serial_no

	field_map = {
		"item_code": "production_item"
	}

	return make_mapped_doc("Production Order", source_name, target_doc, field_map, set_missing_values)


@frappe.whitelist()
def make_invoice(source_name, target_doc=None):
	return make_mapped_doc("Sales Invoice", source_name, target_doc)


@frappe.whitelist()
def make_delivery_note(source_name, target_doc=None):
	def _set_child_fields(source_doc, target_doc, source_parent):
		target_doc.update({
			"qty": 1,
			"uom": frappe.db.get_value("Item", source_doc.item_code, "stock_uom"),
			"serial_no": source_doc.serial_no,
			"warehouse": frappe.db.get_single_value("Repair Settings", "default_incoming_warehouse")
		})

	target_doc = make_mapped_doc("Delivery Note", source_name, target_doc)

	source_doc = frappe.get_doc("Warranty Claim", source_name)
	if source_doc.get("item_code"):
		table_map = {
			"doctype": "Delivery Note Item",
			"postprocess": _set_child_fields
		}
		map_child_doc(source_doc, target_doc, table_map, source_doc)

	return target_doc


# @frappe.whitelist()
# def make_payment_entry(source_name, target_doc=None):
# 	return make_mapped_doc("Payment Entry", source_name, target_doc)


def make_mapped_doc(target_dt, source_name, target_doc, field_map=None, postprocess=None):
	if not field_map:
		field_map = {}

	existing_doc = frappe.get_all(target_dt,
								filters={"warranty_claim": source_name,
										"docstatus": 1})

	if not existing_doc:
		return get_mapped_doc("Warranty Claim", source_name, {
			"Warranty Claim": {
				"doctype": target_dt,
				"field_map": field_map
			},
		}, target_doc, postprocess)
