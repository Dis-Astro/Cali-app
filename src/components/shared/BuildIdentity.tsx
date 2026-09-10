export default function BuildIdentity() {
  if (typeof __SPG_BUILD_INFO__ === "undefined") return null;
  return <p className="mt-4 text-center text-xs text-muted-foreground" title={`Database: ${__SPG_BUILD_INFO__.backendHost}`}>
    Versione {__SPG_BUILD_INFO__.revision} · {__SPG_BUILD_INFO__.builtAt.slice(0, 10)}
  </p>;
}
