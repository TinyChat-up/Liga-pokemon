import { LigaTerrazaGame } from "@/components/liga/LigaTerrazaGame";
import BuyPage from "./comprar/page";

type HomeProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  if (params.game || params.qr || params.player || params.claimMaster) {
    return <LigaTerrazaGame />;
  }

  return <BuyPage />;
}
