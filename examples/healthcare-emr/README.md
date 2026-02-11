# Healthcare EMR Access

This example models access to patient charts in a healthcare setting.

## Domain goals

- clinicians on a patient's care team can access records
- attending physician has direct access
- patient can grant explicit consent viewers
- emergency access (break-glass) can be modeled as direct temporary grants

## Policy summary

- `patient.clinician`
  - `patient.primary_team -> team.clinician`
- `chart.view`
  - attending OR break_glass OR patient consent viewer OR patient clinician
- `chart.edit`
  - attending OR patient clinician

## Notes

This is a simplified policy model for demonstration. Real healthcare systems typically add:

- consent scopes and expiration
- purpose-of-use constraints
- stronger auditing controls

## Run

```bash
bun run examples/healthcare-emr/example.ts
```
