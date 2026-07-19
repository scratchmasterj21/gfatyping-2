// solid-devtools uses a non-standard exports condition (@solid-devtools/source)
// as the first entry, which OXC's module resolver doesn't handle, causing a
// false-positive TS2882 for side-effect imports. This declaration silences it.
declare module "solid-devtools";
