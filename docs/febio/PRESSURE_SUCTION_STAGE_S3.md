# Pressure-Driven Suction Stage S3

This note records the current Stage S3 contract for `P_hold` and the internal unit system.

## Unit System

- Unit system: `um-s-kPa-nN`.
- Length: `um`.
- Time: `s`.
- Stress and pressure: `kPa`.
- Force: `nN`.
- Conversion used by the model: `1 kPa * um^2 = 1 nN`.

## Suction Pressure

- `P_hold` is a positive suction pressure magnitude in `kPa`.
- FEBio export serializes `P_hold` as negative pressure on `pipette_contact_surface`.
- The exported pressure load uses `suction_pressure_curve`.
- Prescribed pipette motion remains a separate positioning control.
- `Fhold` remains a hold-force proxy for continuity with the current main path.

## Source Files

- `src/model/types.ts`: unit-system metadata.
- `src/model/defaults.ts`: editable default label for `P_hold`.
- `src/model/schema.ts`: canonical schema description for `P_hold`.
- `src/febio/export/index.ts`: FEBio pressure load and XML serialization.
