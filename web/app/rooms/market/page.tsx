import { RoomContractView } from "../RoomContractView";

export default async function MarketRoom({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return <RoomContractView room="market" title="Market" searchParams={searchParams} />;
}

