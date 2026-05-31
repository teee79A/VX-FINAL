import { RoomContractView } from "../RoomContractView";

export default async function OpsRoom({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return <RoomContractView room="ops" title="Operations" searchParams={searchParams} />;
}

