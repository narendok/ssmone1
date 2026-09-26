WITH parent_categories(name, slug, sort_order) AS (
  VALUES
    ('Resistor/Pot', 'resistor-pot', 1),
    ('Capacitor', 'capacitor', 2),
    ('Inductor/FB', 'inductor-fb', 3),
    ('Transistor/Diode', 'transistor-diode', 4),
    ('IC/MCU/Reg', 'ic-mcu-reg', 5),
    ('Connector/Switch', 'connector-switch', 6),
    ('Module/Boards', 'module-boards', 7),
    ('PCB/Harness', 'pcb-harness', 8),
    ('Tools/Wires', 'tools-wires', 9),
    ('Fuse/ESD/Filter', 'fuse-esd-filter', 10),
    ('Motor/Sensor/RF', 'motor-sensor-rf', 11)
)
INSERT INTO public.categories (name, slug, parent_id, icon, sort_order)
SELECT name, slug, NULL, NULL, sort_order
FROM parent_categories
ON CONFLICT (slug) DO NOTHING;

WITH child_categories(parent_slug, name, slug, sort_order) AS (
  VALUES
    ('resistor-pot', 'Automotive SMD', 'rp-automotive-smd', 1),
    ('resistor-pot', 'Industrial SMD', 'rp-industrial-smd', 2),
    ('resistor-pot', 'TH 1/5%', 'rp-th', 3),
    ('resistor-pot', 'Potentiometer', 'rp-potentiometer', 4),
    ('capacitor', 'Ceramic', 'cap-ceramic', 1),
    ('capacitor', 'Electrolytic', 'cap-electrolytic', 2),
    ('capacitor', 'Tantalum', 'cap-tantalum', 3),
    ('capacitor', 'Film', 'cap-film', 4),
    ('inductor-fb', 'Inductor', 'if-inductor', 1),
    ('inductor-fb', 'Ferrite Bead', 'if-ferrite-bead', 2),
    ('inductor-fb', 'Choke (Inductor)', 'if-choke', 3),
    ('inductor-fb', 'RF Filter (Inductor)', 'if-rf-filter', 4),
    ('inductor-fb', 'Crystal', 'if-crystal', 5),
    ('transistor-diode', 'MOSFET', 'td-mosfet', 1),
    ('transistor-diode', 'BJT', 'td-bjt', 2),
    ('transistor-diode', 'Diode', 'td-diode', 3),
    ('transistor-diode', 'LED', 'td-led', 4),
    ('ic-mcu-reg', 'Logic', 'ic-logic', 1),
    ('ic-mcu-reg', 'MCU', 'ic-mcu', 2),
    ('ic-mcu-reg', 'Communication', 'ic-communication', 3),
    ('ic-mcu-reg', 'Battery IC', 'ic-battery', 4),
    ('ic-mcu-reg', 'Power', 'ic-power', 5),
    ('ic-mcu-reg', 'Memory IC', 'ic-mcu-memory', 6),
    ('connector-switch', 'Battery Connector', 'cs-battery', 1),
    ('connector-switch', 'USB', 'cs-usb', 2),
    ('connector-switch', 'Holder', 'cs-holder', 3),
    ('connector-switch', 'Heat sink', 'cs-heat-sink', 4),
    ('connector-switch', 'Header', 'cs-header', 5),
    ('connector-switch', 'Relay', 'cs-relay', 6),
    ('connector-switch', 'Switch', 'cs-switch', 7),
    ('module-boards', 'Power Supply', 'mb-power-supply', 1),
    ('module-boards', 'RF/Wireless', 'mb-rf-wireless', 2),
    ('module-boards', 'Sensor Module', 'mb-sensor', 3),
    ('module-boards', 'Display', 'mb-display', 4),
    ('module-boards', 'EVK Board', 'mb-evk-board', 5),
    ('pcb-harness', 'Bare PCB', 'ph-bare-pcb', 1),
    ('pcb-harness', 'Ready PCB', 'ph-ready-pcb', 2),
    ('pcb-harness', 'Harness', 'ph-harness', 3),
    ('tools-wires', 'Electronics', 'tw-electronics', 1),
    ('tools-wires', 'Adapters', 'tw-adapters', 2),
    ('tools-wires', 'Mechanical', 'tw-mechanical', 3),
    ('tools-wires', 'Wiring', 'tw-wiring', 4),
    ('tools-wires', 'Shrink Sleeve', 'tw-shrink-sleeve', 5),
    ('fuse-esd-filter', 'Fuse', 'fef-fuse', 1),
    ('fuse-esd-filter', 'Choke (Filter)', 'fef-choke', 2),
    ('fuse-esd-filter', 'RF Filter (ESD)', 'fef-rf-filter', 3),
    ('fuse-esd-filter', 'ESD', 'fef-esd', 4),
    ('motor-sensor-rf', 'Thermistor', 'msr-thermistor', 1),
    ('motor-sensor-rf', 'Antenna', 'msr-antenna', 2),
    ('motor-sensor-rf', 'Sensor', 'msr-sensor', 3),
    ('motor-sensor-rf', 'Motor', 'msr-motor', 4),
    ('motor-sensor-rf', 'Buzzer', 'msr-buzzer', 5)
)
INSERT INTO public.categories (name, slug, parent_id, icon, sort_order)
SELECT child.name, child.slug, parent.id, NULL, child.sort_order
FROM child_categories child
JOIN public.categories parent ON parent.slug = child.parent_slug
ON CONFLICT (slug) DO NOTHING;