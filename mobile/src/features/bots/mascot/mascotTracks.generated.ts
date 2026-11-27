// Arquivo gerado automaticamente por scripts/extract-prototype.mjs — não editar à mão.
export type ProtoMascotState = 'idle' | 'blink' | 'gentleman' | 'happy' | 'thinking' | 'curious' | 'surprised' | 'sleeping' | 'dance';

export interface PartAnimationTrack {
  part: string;
  keyframe: string;
  durationMs: number;
  delayMs: number;
  bezier: [number, number, number, number];
  stops: Record<string, Record<string, string>>;
}

export type MascotTracksByState = Record<ProtoMascotState, PartAnimationTrack[]>;

export const MASCOT_TRACKS: MascotTracksByState = {
  idle: [
    {"part":"rig-whole","keyframe":"anim-idle-float","durationMs":3200,"delayMs":0,"bezier":[0.45,0,0.55,1],"stops":{"0%,100%":{"transform":"translate3d(0,0,0)"},"50%":{"transform":"translate3d(0,-9px,0)"}}},
    {"part":"rig-hat","keyframe":"anim-idle-hat-follow","durationMs":3200,"delayMs":0,"bezier":[0.45,0,0.55,1],"stops":{"0%,100%":{"transform":"translate3d(0,0,0) rotate(0)"},"55%":{"transform":"translate3d(1px,-3.5px,0) rotate(1.6deg)"}}},
    {"part":"rig-eyes-group","keyframe":"anim-idle-face-parallax","durationMs":3200,"delayMs":0,"bezier":[0.45,0,0.55,1],"stops":{"0%,100%":{"transform":"translate3d(0,0,0)"},"50%":{"transform":"translate3d(0,-2px,0)"}}},
    {"part":"rig-bowtie","keyframe":"anim-idle-bowtie-follow","durationMs":3200,"delayMs":0,"bezier":[0.45,0,0.55,1],"stops":{"0%,100%":{"transform":"translate3d(0,0,0) scale(1)"},"52%":{"transform":"translate3d(0,-1.5px,0) scale(1.025)"}}},
    {"part":"rig-eye-left","keyframe":"anim-blink-eyes","durationMs":4200,"delayMs":0,"bezier":[0.4,0,0.2,1],"stops":{"0%,44%,50%,78%,84%,100%":{"transform":"scaleY(1)"},"47%,81%":{"transform":"scaleY(.06)"}}},
    {"part":"rig-eye-right","keyframe":"anim-blink-eyes","durationMs":4200,"delayMs":0,"bezier":[0.4,0,0.2,1],"stops":{"0%,44%,50%,78%,84%,100%":{"transform":"scaleY(1)"},"47%,81%":{"transform":"scaleY(.06)"}}},
  ],
  blink: [
    {"part":"rig-eye-left","keyframe":"anim-blink-eyes","durationMs":3600,"delayMs":0,"bezier":[0.4,0,0.2,1],"stops":{"0%,44%,50%,78%,84%,100%":{"transform":"scaleY(1)"},"47%,81%":{"transform":"scaleY(.06)"}}},
    {"part":"rig-eye-right","keyframe":"anim-blink-eyes","durationMs":3600,"delayMs":0,"bezier":[0.4,0,0.2,1],"stops":{"0%,44%,50%,78%,84%,100%":{"transform":"scaleY(1)"},"47%,81%":{"transform":"scaleY(.06)"}}},
  ],
  gentleman: [
    {"part":"rig-whole","keyframe":"anim-gentleman-nod","durationMs":3000,"delayMs":0,"bezier":[0.4,0,0.2,1],"stops":{"0%,18%,82%,100%":{"transform":"translate3d(0,0,0) rotate(0)"},"38%,60%":{"transform":"translate3d(0,4px,0) rotate(2.5deg)"}}},
    {"part":"rig-eyes-group","keyframe":"anim-gentleman-face","durationMs":3000,"delayMs":0,"bezier":[0.4,0,0.2,1],"stops":{"0%,18%,82%,100%":{"transform":"translate3d(0,0,0)"},"38%,60%":{"transform":"translate3d(3px,4px,0)"}}},
    {"part":"rig-hat","keyframe":"anim-hat-tip","durationMs":3000,"delayMs":0,"bezier":[0.34,1.45,0.64,1],"stops":{"0%,18%,82%,100%":{"transform":"translate3d(0,0,0) rotate(0)"},"36%,62%":{"transform":"translate3d(14px,-22px,0) rotate(18deg)"},"48%":{"transform":"translate3d(16px,-25px,0) rotate(21deg)"}}},
    {"part":"rig-eye-right","keyframe":"anim-wink-right","durationMs":3000,"delayMs":0,"bezier":[0.4,0,0.2,1],"stops":{"0%,26%,68%,100%":{"transform":"scaleY(1)"},"36%,56%":{"transform":"scaleY(.08)"}}},
    {"part":"rig-bowtie","keyframe":"anim-bowtie-wiggle","durationMs":3000,"delayMs":0,"bezier":[0.4,0,0.2,1],"stops":{"0%,22%,78%,100%":{"transform":"rotate(0) scale(1)"},"34%":{"transform":"rotate(-7deg) scale(1.06)"},"46%":{"transform":"rotate(7deg) scale(1.06)"},"58%":{"transform":"rotate(-4deg) scale(1.03)"}}},
  ],
  happy: [
    {"part":"rig-whole","keyframe":"anim-happy-hop","durationMs":2000,"delayMs":0,"bezier":[0.42,0,0.58,1],"stops":{"0%,100%":{"transform":"translate3d(0,0,0)"},"25%":{"transform":"translate3d(0,-18px,0) rotate(-1.5deg)"},"50%":{"transform":"translate3d(0,0,0)"},"75%":{"transform":"translate3d(0,-18px,0) rotate(1.5deg)"}}},
    {"part":"rig-hat","keyframe":"anim-happy-hat","durationMs":2000,"delayMs":0,"bezier":[0.42,0,0.58,1],"stops":{"0%,50%,100%":{"transform":"translate3d(0,0,0) rotate(0)"},"28%":{"transform":"translate3d(-2px,-9px,0) rotate(-4deg)"},"78%":{"transform":"translate3d(2px,-9px,0) rotate(5deg)"}}},
    {"part":"rig-bowtie","keyframe":"anim-happy-bowtie","durationMs":2000,"delayMs":0,"bezier":[0.65,0,0.35,1],"stops":{"0%,12%":{"transform":"rotate(0) scale(1)"},"45%,55%":{"transform":"rotate(180deg) scale(1.08)"},"88%,100%":{"transform":"rotate(360deg) scale(1)"}}},
    {"part":"fx-sparkles","keyframe":"anim-happy-sparkles","durationMs":2000,"delayMs":0,"bezier":[0.42,0,0.58,1],"stops":{"0%,100%":{"opacity":"0","transform":"translate3d(0,4px,0) scale(.75)"},"25%,75%":{"opacity":"1","transform":"translate3d(0,-4px,0) scale(1)"}}},
  ],
  thinking: [
    {"part":"rig-whole","keyframe":"anim-thinking-body","durationMs":3400,"delayMs":0,"bezier":[0.45,0,0.55,1],"stops":{"0%,100%":{"transform":"translate3d(0,0,0) rotate(0)"},"30%,75%":{"transform":"translate3d(0,-5px,0) rotate(-1.8deg)"}}},
    {"part":"rig-eyes-group","keyframe":"anim-thinking-eyes","durationMs":3400,"delayMs":0,"bezier":[0.4,0,0.2,1],"stops":{"0%,15%,100%":{"transform":"translate3d(0,0,0)"},"30%,75%":{"transform":"translate3d(11px,-12px,0)"},"52%":{"transform":"translate3d(7px,-14px,0)"}}},
    {"part":"rig-bowtie","keyframe":"anim-thinking-bowtie","durationMs":3400,"delayMs":0,"bezier":[0.4,0,0.2,1],"stops":{"0%,15%,100%":{"transform":"translate3d(0,0,0)"},"30%,75%":{"transform":"translate3d(4px,-3px,0)"}}},
    {"part":"rig-eye-left","keyframe":"anim-thinking-squint","durationMs":3400,"delayMs":0,"bezier":[0.4,0,0.2,1],"stops":{"0%,15%,100%":{"transform":"scaleY(1)"},"30%,75%":{"transform":"scaleY(.72)"}}},
    {"part":"rig-hat","keyframe":"anim-thinking-hat","durationMs":3400,"delayMs":0,"bezier":[0.45,0,0.55,1],"stops":{"0%,15%,100%":{"transform":"rotate(0) translate3d(0,0,0)"},"30%,75%":{"transform":"rotate(-3.5deg) translate3d(-2px,-3px,0)"}}},
    {"part":"fx-dot-1","keyframe":"anim-thinking-dots","durationMs":1500,"delayMs":0,"bezier":[0.42,0,0.58,1],"stops":{"0%,100%":{"opacity":".25","transform":"translate3d(0,3px,0) scale(.88)"},"50%":{"opacity":"1","transform":"translate3d(0,-4px,0) scale(1.06)"}}},
    {"part":"fx-dot-2","keyframe":"anim-thinking-dots","durationMs":1500,"delayMs":250,"bezier":[0.42,0,0.58,1],"stops":{"0%,100%":{"opacity":".25","transform":"translate3d(0,3px,0) scale(.88)"},"50%":{"opacity":"1","transform":"translate3d(0,-4px,0) scale(1.06)"}}},
    {"part":"fx-dot-3","keyframe":"anim-thinking-dots","durationMs":1500,"delayMs":500,"bezier":[0.42,0,0.58,1],"stops":{"0%,100%":{"opacity":".25","transform":"translate3d(0,3px,0) scale(.88)"},"50%":{"opacity":"1","transform":"translate3d(0,-4px,0) scale(1.06)"}}},
  ],
  curious: [
    {"part":"rig-whole","keyframe":"anim-curious-body","durationMs":3800,"delayMs":0,"bezier":[0.4,0,0.2,1],"stops":{"0%,14%,86%,100%":{"transform":"rotate(0) translate3d(0,0,0)"},"26%,44%":{"transform":"rotate(-2.2deg) translate3d(-4px,0,0)"},"58%,76%":{"transform":"rotate(2.2deg) translate3d(4px,0,0)"}}},
    {"part":"rig-eyes-group","keyframe":"anim-curious-eyes","durationMs":3800,"delayMs":0,"bezier":[0.4,0,0.2,1],"stops":{"0%,14%,86%,100%":{"transform":"translate3d(0,0,0)"},"26%,44%":{"transform":"translate3d(-18px,-2px,0)"},"58%,76%":{"transform":"translate3d(18px,-2px,0)"}}},
    {"part":"rig-bowtie","keyframe":"anim-curious-bowtie","durationMs":3800,"delayMs":0,"bezier":[0.4,0,0.2,1],"stops":{"0%,14%,86%,100%":{"transform":"translate3d(0,0,0)"},"26%,44%":{"transform":"translate3d(-7px,0,0)"},"58%,76%":{"transform":"translate3d(7px,0,0)"}}},
    {"part":"rig-hat","keyframe":"anim-curious-hat","durationMs":3800,"delayMs":0,"bezier":[0.4,0,0.2,1],"stops":{"0%,14%,86%,100%":{"transform":"translate3d(0,0,0) rotate(0)"},"26%,44%":{"transform":"translate3d(5px,-2px,0) rotate(-2.5deg)"},"58%,76%":{"transform":"translate3d(-5px,2px,0) rotate(2.5deg)"}}},
    {"part":"rig-eye-left","keyframe":"anim-curious-left-eye","durationMs":3800,"delayMs":0,"bezier":[0.4,0,0.2,1],"stops":{"0%,14%,86%,100%":{"transform":"scaleY(1)"},"26%,44%":{"transform":"scaleY(1.06)"},"58%,76%":{"transform":"scaleY(.65)"}}},
    {"part":"rig-eye-right","keyframe":"anim-curious-right-eye","durationMs":3800,"delayMs":0,"bezier":[0.4,0,0.2,1],"stops":{"0%,14%,86%,100%":{"transform":"scaleY(1)"},"26%,44%":{"transform":"scaleY(.65)"},"58%,76%":{"transform":"scaleY(1.06)"}}},
  ],
  surprised: [
    {"part":"rig-whole","keyframe":"anim-surprised-body","durationMs":2600,"delayMs":0,"bezier":[0.34,1.4,0.64,1],"stops":{"0%,18%,72%,100%":{"transform":"translate3d(0,0,0)"},"24%":{"transform":"translate3d(0,5px,0)"},"34%,46%":{"transform":"translate3d(0,-14px,0)"},"58%":{"transform":"translate3d(0,2px,0)"}}},
    {"part":"rig-hat","keyframe":"anim-surprised-hat","durationMs":2600,"delayMs":0,"bezier":[0.34,1.4,0.64,1],"stops":{"0%,22%,68%,100%":{"transform":"translate3d(0,0,0) rotate(0)"},"36%,44%":{"transform":"translate3d(6px,-28px,0) rotate(-8deg)"},"56%":{"transform":"translate3d(-1px,2px,0) rotate(2deg)"}}},
    {"part":"rig-eye-left","keyframe":"anim-surprised-eyes","durationMs":2600,"delayMs":0,"bezier":[0.34,1.4,0.64,1],"stops":{"0%,20%,68%,100%":{"transform":"scale(1)"},"32%,48%":{"transform":"scale(1.16)"}}},
    {"part":"rig-eye-right","keyframe":"anim-surprised-eyes","durationMs":2600,"delayMs":0,"bezier":[0.34,1.4,0.64,1],"stops":{"0%,20%,68%,100%":{"transform":"scale(1)"},"32%,48%":{"transform":"scale(1.16)"}}},
    {"part":"rig-bowtie","keyframe":"anim-surprised-bowtie","durationMs":2600,"delayMs":0,"bezier":[0.42,0,0.58,1],"stops":{"0%,22%,68%,100%":{"transform":"scale(1) rotate(0)"},"34%":{"transform":"scale(1.18) rotate(-6deg)"},"44%":{"transform":"scale(1.18) rotate(6deg)"}}},
    {"part":"fx-alert","keyframe":"anim-surprised-fx","durationMs":2600,"delayMs":0,"bezier":[0.42,0,0.58,1],"stops":{"0%,24%,58%,100%":{"opacity":"0","transform":"scale(.8)"},"32%,48%":{"opacity":"1","transform":"scale(1)"}}},
  ],
  sleeping: [
    {"part":"rig-whole","keyframe":"anim-sleep-breathe","durationMs":4000,"delayMs":0,"bezier":[0.45,0,0.55,1],"stops":{"0%,100%":{"transform":"translate3d(0,3px,0)"},"50%":{"transform":"translate3d(0,-4px,0)"}}},
    {"part":"rig-hat","keyframe":"anim-sleep-hat","durationMs":4000,"delayMs":0,"bezier":[0.45,0,0.55,1],"stops":{"0%,100%":{"transform":"translate3d(-8px,6px,0) rotate(-9deg)"},"50%":{"transform":"translate3d(-6px,2px,0) rotate(-6.5deg)"}}},
    {"part":"rig-eyes-group","keyframe":"anim-sleep-face","durationMs":4000,"delayMs":0,"bezier":[0.45,0,0.55,1],"stops":{"0%,100%":{"transform":"translate3d(0,3px,0)"},"50%":{"transform":"translate3d(0,-2px,0)"}}},
    {"part":"fx-z-1","keyframe":"anim-sleep-z1","durationMs":3000,"delayMs":0,"bezier":[0,0,0.58,1],"stops":{"0%":{"opacity":"0","transform":"translate3d(0,8px,0) scale(.75)"},"35%":{"opacity":"1"},"100%":{"opacity":"0","transform":"translate3d(18px,-28px,0) scale(1.08)"}}},
    {"part":"fx-z-2","keyframe":"anim-sleep-z1","durationMs":3000,"delayMs":1000,"bezier":[0,0,0.58,1],"stops":{"0%":{"opacity":"0","transform":"translate3d(0,8px,0) scale(.75)"},"35%":{"opacity":"1"},"100%":{"opacity":"0","transform":"translate3d(18px,-28px,0) scale(1.08)"}}},
    {"part":"fx-z-3","keyframe":"anim-sleep-z1","durationMs":3000,"delayMs":2000,"bezier":[0,0,0.58,1],"stops":{"0%":{"opacity":"0","transform":"translate3d(0,8px,0) scale(.75)"},"35%":{"opacity":"1"},"100%":{"opacity":"0","transform":"translate3d(18px,-28px,0) scale(1.08)"}}},
  ],
  dance: [
    {"part":"rig-whole","keyframe":"anim-dance-body","durationMs":1800,"delayMs":0,"bezier":[0.45,0,0.55,1],"stops":{"0%,100%":{"transform":"translate3d(-7px,0,0) rotate(-2.5deg)"},"25%":{"transform":"translate3d(0,-10px,0) rotate(0)"},"50%":{"transform":"translate3d(7px,0,0) rotate(2.5deg)"},"75%":{"transform":"translate3d(0,-10px,0) rotate(0)"}}},
    {"part":"rig-eyes-group","keyframe":"anim-dance-eyes","durationMs":1800,"delayMs":0,"bezier":[0.45,0,0.55,1],"stops":{"0%,100%":{"transform":"translate3d(-6px,0,0)"},"25%":{"transform":"translate3d(0,-3px,0)"},"50%":{"transform":"translate3d(6px,0,0)"},"75%":{"transform":"translate3d(0,-3px,0)"}}},
    {"part":"rig-hat","keyframe":"anim-dance-hat","durationMs":1800,"delayMs":0,"bezier":[0.45,0,0.55,1],"stops":{"0%,100%":{"transform":"translate3d(-2px,0,0) rotate(-3deg)"},"25%":{"transform":"translate3d(0,-6px,0) rotate(2deg)"},"50%":{"transform":"translate3d(2px,0,0) rotate(3deg)"},"75%":{"transform":"translate3d(0,-6px,0) rotate(-2deg)"}}},
    {"part":"rig-bowtie","keyframe":"anim-dance-bowtie","durationMs":900,"delayMs":0,"bezier":[0.45,0,0.55,1],"stops":{"0%,100%":{"transform":"translate3d(-3px,0,0) rotate(-6deg) scale(1.04)"},"50%":{"transform":"translate3d(3px,0,0) rotate(6deg) scale(1.04)"}}},
    {"part":"rig-eye-left","keyframe":"anim-blink-eyes","durationMs":3600,"delayMs":0,"bezier":[0.4,0,0.2,1],"stops":{"0%,44%,50%,78%,84%,100%":{"transform":"scaleY(1)"},"47%,81%":{"transform":"scaleY(.06)"}}},
    {"part":"rig-eye-right","keyframe":"anim-blink-eyes","durationMs":3600,"delayMs":0,"bezier":[0.4,0,0.2,1],"stops":{"0%,44%,50%,78%,84%,100%":{"transform":"scaleY(1)"},"47%,81%":{"transform":"scaleY(.06)"}}},
  ],
};
