import { LigaTerrazaGame } from "@/components/liga/LigaTerrazaGame";
import Storefront from "./Storefront";

type HomeProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  if (params.game || params.qr || params.player || params.claimMaster) {
    return <LigaTerrazaGame />;
  }

  return <Storefront />;
}
