DO $$
DECLARE
  v_actor uuid;
  v_root uuid;
  v_top uuid;
  v_device uuid;
  v_revision uuid;
  v_phase uuid;
  v_folder uuid;
  v_device_name text;
  v_revision_name text;
  v_phase_name text;
  v_doc record;
BEGIN
  SELECT id INTO v_actor FROM public.profiles ORDER BY created_at NULLS LAST LIMIT 1;
  INSERT INTO public.drive_nodes (project_id,parent_id,name,slug,node_type,is_locked,created_by,metadata)
  VALUES (NULL,NULL,'SAMPLE — 00_Automotive_Hardware_Audit_Repository','sample-00-automotive-hardware-audit-repository','FOLDER',true,v_actor,jsonb_build_object('sample',true,'source','Google Drive Audit Repository Architecture'))
  RETURNING id INTO v_root;

  FOR v_doc IN SELECT * FROM (VALUES
    ('SAMPLE — 01_Governance_QMS_&_Section_Controls','sample-01-governance-qms-section-controls'),
    ('SAMPLE — 02_Product_Platforms_&_Device_Audit_Packs','sample-02-product-platforms-device-audit-packs'),
    ('SAMPLE — 03_Supplier_Quality_&_Incoming_Inspection','sample-03-supplier-quality-incoming-inspection'),
    ('SAMPLE — 04_Equipment_Calibration_&_Laboratory_Controls','sample-04-equipment-calibration-laboratory-controls')
  ) AS x(name,slug) LOOP
    INSERT INTO public.drive_nodes (project_id,parent_id,name,slug,node_type,is_locked,created_by,metadata)
    VALUES (NULL,v_root,v_doc.name,v_doc.slug,'FOLDER',true,v_actor,jsonb_build_object('sample',true)) RETURNING id INTO v_top;
    IF v_doc.name = 'SAMPLE — 01_Governance_QMS_&_Section_Controls' THEN
      FOR v_doc IN SELECT * FROM (VALUES
        ('SAMPLE — HW_RES_001_Responsibility_&_Authority_Matrix.controlled-record','HW_RES_001'),('SAMPLE — HW_KPI_001_Embedded_Hardware_KPI_Matrix.controlled-record','HW_KPI_001'),('SAMPLE — HW_SOP_001_New_Product_Development_SOP.controlled-record','HW_SOP_001'),('SAMPLE — HLPL_QMSP_HW_001_Hardware_Department_SOP.controlled-record','HLPL_QMSP_HW_001'),('SAMPLE — HW_Process_Flowchart_HW01_to_HW37.controlled-record','HW_FLOW_01_37')
      ) AS g(name,code) LOOP
        INSERT INTO public.drive_nodes (project_id,parent_id,name,slug,node_type,file_type,mime_type,file_size_bytes,storage_bucket,storage_path,is_locked,created_by,metadata)
        VALUES (NULL,v_top,v_doc.name,'sample-'||md5(v_doc.name),'FILE','OTHER','application/x-ssm-controlled-document-placeholder',0,'project-drive','sample-controlled-placeholders/'||md5(v_doc.name)||'.placeholder',true,v_actor,jsonb_build_object('sample',true,'placeholder',true,'controlled_document',true,'document_code',v_doc.code));
      END LOOP;
    END IF;
  END LOOP;

  SELECT id INTO v_top FROM public.drive_nodes WHERE parent_id=v_root AND name='SAMPLE — 02_Product_Platforms_&_Device_Audit_Packs';
  FOR v_doc IN SELECT * FROM (VALUES
    ('SAMPLE — BCU_Body_Control_Unit','SAMPLE — BCU_E_V2.1'),('SAMPLE — TCU_Telematics_Control_Unit','SAMPLE — TCU_03_V1.0'),('SAMPLE — ASDL_Differential_Lock_Controller','SAMPLE — ASDL_V1.0'),('SAMPLE — LFP_LoRa_Fleet_Pro','SAMPLE — LFP_V2.0'),('SAMPLE — Emulator_TCU_Test_Jig','SAMPLE — Emulator_V2.0')
  ) AS d(device_name,revision_name) LOOP
    INSERT INTO public.drive_nodes (project_id,parent_id,name,slug,node_type,is_locked,created_by,metadata) VALUES (NULL,v_top,v_doc.device_name,'sample-'||md5(v_doc.device_name),'FOLDER',true,v_actor,jsonb_build_object('sample',true)) RETURNING id INTO v_device;
    INSERT INTO public.drive_nodes (project_id,parent_id,name,slug,node_type,is_locked,created_by,metadata) VALUES (NULL,v_device,v_doc.revision_name,'sample-'||md5(v_doc.revision_name),'FOLDER',true,v_actor,jsonb_build_object('sample',true,'part_revision',true)) RETURNING id INTO v_revision;
    FOR v_doc IN SELECT * FROM (VALUES
      ('SAMPLE — Phase_1_Requirements_&_Architecture',1),('SAMPLE — Phase_2_Part_Selection_&_Procurement',2),('SAMPLE — Phase_3_Risk_Assessment_&_Test_Planning',3),('SAMPLE — Phase_4_Schematic_Layout_&_Enclosure_Outputs',4),('SAMPLE — Phase_5_Prototype_Fabrication_&_Pre_Compliance',5),('SAMPLE — Phase_6_Validation_Build_&_PPAP_Release',6),('SAMPLE — Phase_7_Post_Release_ECO_&_Regulatory',7)
    ) AS p(name,phase_no) LOOP
      INSERT INTO public.drive_nodes (project_id,parent_id,name,slug,node_type,is_locked,created_by,metadata) VALUES (NULL,v_revision,v_doc.name,'sample-'||md5(v_doc.name||v_revision::text),'FOLDER',true,v_actor,jsonb_build_object('sample',true,'phase',v_doc.phase_no)) RETURNING id INTO v_phase;
      INSERT INTO public.drive_nodes (project_id,parent_id,name,slug,node_type,file_type,mime_type,file_size_bytes,storage_bucket,storage_path,is_locked,created_by,metadata)
      VALUES (NULL,v_phase,'SAMPLE — Controlled_Document_Placeholder_Phase_'||v_doc.phase_no||'.controlled-record','sample-'||md5(v_doc.name||'placeholder'||v_revision::text),'FILE','OTHER','application/x-ssm-controlled-document-placeholder',0,'project-drive','sample-controlled-placeholders/'||md5(v_doc.name||v_revision::text)||'.placeholder',true,v_actor,jsonb_build_object('sample',true,'placeholder',true,'controlled_document',true,'phase',v_doc.phase_no));
    END LOOP;
  END LOOP;

  FOR v_doc IN SELECT * FROM (VALUES
    ('SAMPLE — 03_Supplier_Quality_&_Incoming_Inspection','SAMPLE — PCB_Incoming_Inspection_Logs','SAMPLE — PCB_Incoming_Inspection_Log.controlled-record'),('SAMPLE — 03_Supplier_Quality_&_Incoming_Inspection','SAMPLE — Components_IQC','SAMPLE — Components_IQC_Record.controlled-record'),('SAMPLE — 03_Supplier_Quality_&_Incoming_Inspection','SAMPLE — Harness_IQC','SAMPLE — Harness_IQC_Record.controlled-record'),('SAMPLE — 03_Supplier_Quality_&_Incoming_Inspection','SAMPLE — EMS_Assembly_&_Fabricator_Audit_Records','SAMPLE — EMS_Fabricator_Audit_Record.controlled-record'),('SAMPLE — 04_Equipment_Calibration_&_Laboratory_Controls','SAMPLE — Calibration_Certificates','SAMPLE — Calibration_Certificate.controlled-record'),('SAMPLE — 04_Equipment_Calibration_&_Laboratory_Controls','SAMPLE — Testing_Jigs_&_Fixtures_Validation_Records','SAMPLE — Jig_Fixture_Validation_Record.controlled-record'),('SAMPLE — 04_Equipment_Calibration_&_Laboratory_Controls','SAMPLE — Equipment_Master_List_&_Calibration_Schedule','SAMPLE — Equipment_Master_and_Calibration_Schedule.controlled-record')
  ) AS s(top_name,folder_name,document_name) LOOP
    SELECT id INTO v_top FROM public.drive_nodes WHERE parent_id=v_root AND name=v_doc.top_name;
    INSERT INTO public.drive_nodes (project_id,parent_id,name,slug,node_type,is_locked,created_by,metadata) VALUES (NULL,v_top,v_doc.folder_name,'sample-'||md5(v_doc.folder_name),'FOLDER',true,v_actor,jsonb_build_object('sample',true)) RETURNING id INTO v_folder;
    INSERT INTO public.drive_nodes (project_id,parent_id,name,slug,node_type,file_type,mime_type,file_size_bytes,storage_bucket,storage_path,is_locked,created_by,metadata) VALUES (NULL,v_folder,v_doc.document_name,'sample-'||md5(v_doc.document_name),'FILE','OTHER','application/x-ssm-controlled-document-placeholder',0,'project-drive','sample-controlled-placeholders/'||md5(v_doc.document_name)||'.placeholder',true,v_actor,jsonb_build_object('sample',true,'placeholder',true,'controlled_document',true));
  END LOOP;
END $$;