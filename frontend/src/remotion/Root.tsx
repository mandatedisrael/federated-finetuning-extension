import { Composition } from "remotion";
import { FfeTwitterIntro } from "./FFEIntro";

export const RemotionRoot = () => {
  return (
    <Composition
      id="FfeTwitterIntro"
      component={FfeTwitterIntro}
      durationInFrames={540}
      fps={30}
      width={1080}
      height={1080}
    />
  );
};
