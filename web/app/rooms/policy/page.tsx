import { RoomContractView } from "../RoomContractView";

export default async function PolicyRoom({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return <RoomContractView room="system" title="Policy" searchParams={searchParams} />;
}

