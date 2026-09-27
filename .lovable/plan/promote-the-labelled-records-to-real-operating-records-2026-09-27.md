# Promote the labelled records to real operating records

## Outcome

Convert the recently added projects, clients, audit packs, and document workspace from mistakenly labelled sample content into real SSM One operating records. Preserve every existing relationship, folder, phase, and controlled-document placeholder.

## Changes

1. Promote the four clients, six projects, and seven audit packs already present in the database:
   - Remove the `SAMPLE` prefix from their visible names and identifiers.
   - Mark each record as a real record rather than sample content.
   - Keep the existing project-to-client links, stages, priorities, descriptions, and all other data unchanged.
   - Preserve their existing IDs so future links and history remain intact.

2. Promote the related project document workspaces and the automotive hardware audit repository:
   - Rename the repository root, top-level areas, device/revision folders, seven phases, and controlled-document records without the `SAMPLE — ` label.
   - Replace sample-only slugs with stable real-record slugs.
   - Remove only the sample marker from workspace metadata while retaining the source, phase, revision, controlled-document, and placeholder details.
   - Keep all folders and controlled-document placeholders locked as the standard controlled structure.

3. Preserve document intent and safety:
   - Keep the empty controlled-document entries as clearly identifiable placeholders until real files are uploaded.
   - Do not remove files, folder hierarchy, project links, audit evidence, client relationships, or existing operational records.
   - Add an activity-history entry for the promotion so administrators can see why the labels changed.

4. Verify the conversion:
   - Confirm that no promoted client, project, audit pack, or workspace node remains marked as sample content.
   - Confirm the expected counts and hierarchy remain unchanged.
   - Confirm project links, client links, controlled-document placeholders, and access controls remain intact.

## Technical details

- The database currently contains 4 labelled clients, 6 labelled projects, 7 labelled audit packs, and 278 labelled workspace nodes. The drive tree includes one global audit repository and project-related workspaces.
- The conversion will be an in-place, targeted database update based on the existing sample flags and metadata. It will not delete or recreate records.
- The standard Drive permissions and locked controlled-document structure will remain unchanged.