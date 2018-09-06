frappe.ui.form.on("Warranty Claim", {
	refresh: (frm) => {
		frm.add_fetch('item_code', 'item_group', 'item_group');

		if (!frm.doc.is_under_warranty) {
			frm.add_fetch('item_code', 'standard_rate', 'rate');
		};

		frm.fields_dict.item_code.get_query = (doc, cdt, cdn) => {
			return {
				filters: {
					"item_group": ["in", ["Custom", "Full Retail", "Universal"]],
					"is_sales_item": 1
				}
			};
		};

		frm.fields_dict.cable.get_query = (doc, cdt, cdn) => {
			return {
				filters: {
					"item_group": "Cables",
					"is_sales_item": 1
				}
			};
		};

		frm.fields_dict.case.get_query = (doc, cdt, cdn) => {
			return { filters: { "item_group": "Cases" } };
		};

		frm.fields_dict.services.grid.get_field("item_code").get_query = (doc, cdt, cdn) => {
			return { filters: { "item_group": "Services" } };
		};

		if (!frm.doc.__islocal && frm.doc.status != "Completed") {
			// Receive the item from the customer
			if (!frm.doc.item_received) {
				frm.add_custom_button(__("Stock Receipt"), () => {
					frappe.call({
						method: "repairs.api.make_stock_entry_from_warranty_claim",
						args: {
							doc: frm.doc.name
						},
						callback: (r) => {
							if (!r.exc) {
								frm.set_value("received_date", frappe.datetime.now_datetime());
								frm.reload_doc();
							}
						}
					});
				}, __("Make"));
			};

			// Start testing the item
			if (frm.doc.status == "To Test") {
				var repair_btn = frm.add_custom_button(__("Test Item"), () => {
					fields = [
						{ fieldname: "sb_shell", fieldtype: "Section Break" },
						{ label: __("LEFT SHELL"), fieldname: "cb_left_shell", fieldtype: "Column Break" },
						{ label: __("Cracked"), fieldname: "left_cracked_shell", fieldtype: "Check" },
						{ label: __("Broken"), fieldname: "left_broken_shell", fieldtype: "Check" },
						{ label: __("Refit"), fieldname: "left_refit_shell", fieldtype: "Check" },
						{ label: __("RIGHT SHELL"), fieldname: "cb_right_shell", fieldtype: "Column Break" },
						{ label: __("Cracked"), fieldname: "right_cracked_shell", fieldtype: "Check" },
						{ label: __("Broken"), fieldname: "right_broken_shell", fieldtype: "Check" },
						{ label: __("Refit"), fieldname: "right_refit_shell", fieldtype: "Check" },

						{ fieldname: "sb_faceplate", fieldtype: "Section Break" },
						{ label: __("LEFT FACEPLATE"), fieldname: "cb_left_faceplate", fieldtype: "Column Break" },
						{ label: __("Cracked"), fieldname: "left_cracked_faceplate", fieldtype: "Check" },
						{ label: __("Broken"), fieldname: "left_broken_faceplate", fieldtype: "Check" },
						{ label: __("RIGHT FACEPLATE"), fieldname: "cb_right_faceplate", fieldtype: "Column Break" },
						{ label: __("Cracked"), fieldname: "right_cracked_faceplate", fieldtype: "Check" },
						{ label: __("Broken"), fieldname: "right_broken_faceplate", fieldtype: "Check" },

						{ fieldname: "sb_artwork", fieldtype: "Section Break" },
						{ label: __("LEFT ARTWORK"), fieldname: "cb_left_artwork", fieldtype: "Column Break" },
						{ label: __("Replacement"), fieldname: "left_artwork", fieldtype: "Check" },
						{ label: __("RIGHT ARTWORK"), fieldname: "cb_right_artwork", fieldtype: "Column Break" },
						{ label: __("Replacement"), fieldname: "right_artwork", fieldtype: "Check" },

						{ fieldname: "sb_socket", fieldtype: "Section Break" },
						{ label: __("LEFT SOCKET"), fieldname: "cb_left_socket", fieldtype: "Column Break" },
						{ label: __("Broken"), fieldname: "left_broken_socket", fieldtype: "Check" },
						{ label: __("Swap"), fieldname: "left_swap_socket", fieldtype: "Check" },
						{ label: __("Worn Out"), fieldname: "left_worn_out_socket", fieldtype: "Check" },
						{ label: __("Spinning / Loose"), fieldname: "left_loose_socket", fieldtype: "Check" },
						{ label: __("RIGHT SOCKET"), fieldname: "cb_right_socket", fieldtype: "Column Break" },
						{ label: __("Broken"), fieldname: "right_broken_socket", fieldtype: "Check" },
						{ label: __("Swap"), fieldname: "right_swap_socket", fieldtype: "Check" },
						{ label: __("Worn Out"), fieldname: "right_worn_out_socket", fieldtype: "Check" },
						{ label: __("Spinning / Loose"), fieldname: "right_loose_socket", fieldtype: "Check" },

						{ fieldname: "sb_details", fieldtype: "Section Break" },
						{ label: __("Additional Results"), fieldname: "testing_details", fieldtype: "Small Text" }
					]

					frappe.prompt(fields, (data) => {
						frm.set_value("status", "To Repair");
						frm.set_value("tested_by", frappe.session.user);
						frm.set_value("testing_date", frappe.datetime.now_datetime());

						for (var result in data) {
							if (result != "testing_details" && data[result]) {
								var issue_details = result.split("_");

								ear_side = issue_details[0]
								ear_side = ear_side[0].toUpperCase() + ear_side.slice(1);  // Capitalize

								issue_name = issue_details.slice(1).join(" ");
								issue_name = issue_name[0].toUpperCase() + issue_name.slice(1);  // Capitalize

								frm.doc.services.push({
									"issue": issue_name,
									"ear_side": ear_side
								})
							}
						};

						frm.doc.testing_details = data["testing_details"];
						frm.save();
					}, __("Testing Results"), __("Record"));
				});
				repair_btn.addClass('btn-primary');
			};

			// Start the sales cycle for the customer
			if (frm.doc.billing_status == "To Bill") {
				frm.add_custom_button(__("Quotation"), () => {
					if (!frm.doc.services.length) {
						frappe.confirm(__("Do you want to create a Quotation without services?"), () => {
							frm.trigger("make_quotation");
						});
					} else {
						frm.trigger("make_quotation");
					};
				}, __("Make"));
			};

			// Start repairing the item
			if (frm.doc.status == "To Repair") {
				var repair_btn = frm.add_custom_button(__("Start Repair"), () => {
					frappe.model.open_mapped_doc({
						method: "repairs.api.start_repair",
						frm: frm,
						run_link_triggers: true
					});
				});
				repair_btn.addClass('btn-primary');
			};

			// Once repair is completed, make the delivery back to the customer
			if (!in_list(["To Receive", "Completed"], frm.doc.status) && frm.doc.billing_status != "To Bill") {
				frm.add_custom_button(__("Delivery"), () => {
					frappe.model.open_mapped_doc({
						method: "repairs.api.make_delivery_note",
						frm: frm,
						run_link_triggers: true
					});
				}, __("Make"));
			};
		}
	},

	item_received: function (frm) {
		if (frm.doc.item_received) {
			frm.set_value("status", "To Test");
		} else {
			frm.set_value("status", "To Receive");
		}
	},

	make_quotation: function (frm) {
		frappe.model.open_mapped_doc({
			method: "repairs.api.make_quotation",
			frm: frm,
			run_link_triggers: true
		});
	},
});
