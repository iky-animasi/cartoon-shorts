import React from "react";
import { Composition } from "remotion";
import { MolassesShort, MOLASSES_FRAMES } from "./videos/molasses/Molasses";
import { DuniaTanpaSakit, DTS_FRAMES } from "./videos/dunia-tanpa-sakit/DuniaTanpaSakit";
import { DuniaKebal, DK_FRAMES } from "./videos/dunia-kebal/DuniaKebal";
import { DuniaTanpaNgantuk, DTN_FRAMES } from "./videos/dunia-tanpa-ngantuk/DuniaTanpaNgantuk";
import { DuniaTanpaBohong, DTB_FRAMES } from "./videos/dunia-tanpa-bohong/DuniaTanpaBohong";
import { DuniaBisaTerbang, DBT_FRAMES } from "./videos/dunia-bisa-terbang/DuniaBisaTerbang";
import { DuniaSelaluBeruntung, DSB_FRAMES } from "./videos/dunia-selalu-beruntung/DuniaSelaluBeruntung";

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
      <Composition
        id="DuniaKebal"
        component={DuniaKebal}
        durationInFrames={DK_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="DuniaTanpaNgantuk"
        component={DuniaTanpaNgantuk}
        durationInFrames={DTN_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="DuniaTanpaBohong"
        component={DuniaTanpaBohong}
        durationInFrames={DTB_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="DuniaBisaTerbang"
        component={DuniaBisaTerbang}
        durationInFrames={DBT_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="DuniaSelaluBeruntung"
        component={DuniaSelaluBeruntung}
        durationInFrames={DSB_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
