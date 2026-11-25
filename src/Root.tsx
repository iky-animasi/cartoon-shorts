import React from "react";
import { Composition } from "remotion";
import { MolassesShort, MOLASSES_FRAMES } from "./videos/molasses/Molasses";
import { DuniaTanpaSakit, DTS_FRAMES } from "./videos/dunia-tanpa-sakit/DuniaTanpaSakit";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MolassesShort"
        component={MolassesShort}
        durationInFrames={MOLASSES_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="DuniaTanpaSakit"
        component={DuniaTanpaSakit}
        durationInFrames={DTS_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
