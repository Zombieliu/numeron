# Hunyuan 3D Unit Prompts

These prompts are tuned for Tencent Hunyuan 3D Studio style generation of static, game-readable `Numeron` assets.

Use `image-to-3d` whenever possible. If you must use text-only generation, start from these prompts and iterate toward stronger silhouette and cleaner faction blocking.

## Global Base Prompt

Apply this as the common base for every unit:

```text
Stylized game-ready fantasy sci-fi battler character, full body, single character, neutral pose, clean silhouette, readable from mid-distance, suitable for isometric auto-battler camera, strong faction color blocking, exaggerated weapon and shoulder shapes, simple background, production-friendly surface detail, static model for glb export.
```

## Shared Negative Prompt

Use this to suppress bad generations:

```text
multiple characters, busy background, cinematic scene, extreme realism, tiny accessories, cluttered silhouette, broken hands, missing weapon, floating parts, asymmetry glitches, heavy transparency, excessive ornament noise, unreadable face, cropped body, dynamic action pose, soft blob geometry
```

## 中文直投模板

如果你直接在混元 3D Studio 里用中文提示词，优先用这一套，而不是把英文 prompt 直接机翻。

### 中文基础模板

```text
风格化游戏角色，单个角色，全身，标准站姿，轮廓清晰，适合自动战棋/自走棋 2.5D 俯视斜角镜头，中景可读性强，武器和肩部特征明显，配色分区明确，背景干净，适合导出为 glb 的静态 3D 模型。
```

### 中文负面模板

```text
多人，同屏多个角色，复杂背景，电影镜头，超写实，动作姿势过大，身体残缺，武器缺失，手部错误，轮廓模糊，细节过碎，漂浮部件，透明材质过多，难以识别职业，裁切画面，只显示半身
```

### 中文使用规则

- 先贴 `中文基础模板`
- 再贴单角色专属描述
- 最后补 `中文负面模板`
- 如果首轮结果“太花”或“太像展示雕像”，加一句：
  - `减少无关装饰，强调游戏内识别度和中距离轮廓`
- 如果首轮结果“太写实”，加一句：
  - `降低写实度，提升风格化和图形化概括`
- 如果首轮结果“武器看不清”，加一句：
  - `强化武器轮廓，让武器在缩小后仍然清晰`

## Faction And Role Guide

### Dawn

- brighter palette
- cleaner shapes
- support or disciplined military feel

### Dusk

- darker palette
- sharper silhouettes
- more predatory or corrupted pressure

### Vanguard

- heavier lower body
- broad shoulders
- stronger shield or armor read

### Skirmisher

- lighter frame
- longer weapon read
- more speed and agility in silhouette

## Unit Prompts

### Verdant Bruiser

```text
Stylized game-ready fantasy sci-fi frontline bruiser, heavy dawn-aligned defender with teal and moss-green accents, broad shoulders, thick armored forearms, blunt impact weapon, stable grounded stance, bulky readable silhouette, tanky but not fully knight-like, single character, neutral pose, simple background, suitable for isometric auto-battler camera, static glb-ready model.
```

中文直投：

```text
风格化游戏前排斗士，黎明阵营，青绿和苔绿色主配色，体型厚重，肩膀宽，前臂护甲明显，使用重型钝器或巨型拳套，站姿稳定扎实，轮廓厚实易读，偏坦克但不是传统骑士，适合自走棋 2.5D 俯视斜角镜头，单个角色，全身，标准站姿，背景干净，适合导出静态 glb 模型。
```

### Signal Ranger

```text
Stylized game-ready ranged scout, dawn-aligned precision ranger with blue signal-tech accents, long rifle or signal bow silhouette, slim agile body, clean readable upper body shape, high clarity weapon profile, disciplined marksman look, single character, neutral pose, simple background, suitable for isometric auto-battler camera, static glb-ready model.
```

中文直投：

```text
风格化游戏远程侦察射手，黎明阵营，蓝色信号科技风点缀，细长敏捷体型，使用长枪或信号弓，武器轮廓清晰，肩颈和上半身识别明显，整体像纪律严明的神射手，适合自走棋 2.5D 俯视斜角镜头，单个角色，全身，标准站姿，背景干净，适合导出静态 glb 模型。
```

### Ash Duelist

```text
Stylized game-ready dusk duelist, agile melee assassin with ember-red accents, lean athletic build, curved blade silhouette, sharp shoulder shapes, predatory fast attacker look, readable from distance, single character, neutral pose, simple background, suitable for isometric auto-battler camera, static glb-ready model.
```

中文直投：

```text
风格化游戏近战决斗者，黄昏阵营，灰烬红点缀，身形修长敏捷，使用弯刀或弧形双刃，肩部轮廓锐利，整体像高速猎杀型刺客，攻击性强，中距离也容易识别，适合自走棋 2.5D 俯视斜角镜头，单个角色，全身，标准站姿，背景干净，适合导出静态 glb 模型。
```

### Iron Vanguard

```text
Stylized game-ready heavy vanguard knight, dusk-aligned armored frontline tank with dark iron and crimson accents, tower-shield silhouette, massive chest armor, low center of gravity, broad shoulders, strong defensive presence, single character, neutral pose, simple background, suitable for isometric auto-battler camera, static glb-ready model.
```

中文直投：

```text
风格化游戏重装先锋骑士，黄昏阵营，深铁灰和暗红色主配色，前排坦克，塔盾轮廓非常明显，胸甲厚重，重心低，肩膀宽，防御压迫感强，整体像守线核心单位，适合自走棋 2.5D 俯视斜角镜头，单个角色，全身，标准站姿，背景干净，适合导出静态 glb 模型。
```

### Frost Oracle

```text
Stylized game-ready dawn frost caster, elegant ranged oracle with pale blue and silver accents, staff or catalyst silhouette, layered robes or plated cloth, cool mystic support-damage feel, readable headpiece, clear upper-body silhouette, single character, neutral pose, simple background, suitable for isometric auto-battler camera, static glb-ready model.
```

中文直投：

```text
风格化游戏寒霜先知，黎明阵营，浅蓝和银白主配色，远程法系角色，使用法杖或施法核心，服装是分层长袍与轻甲结合，气质冷静神秘，头部装饰和上半身轮廓清晰，有支援加输出的感觉，适合自走棋 2.5D 俯视斜角镜头，单个角色，全身，标准站姿，背景干净，适合导出静态 glb 模型。
```

### Ember Medic

```text
Stylized game-ready battlefield medic, dawn-aligned healer with warm amber and white accents, compact support silhouette, medical canister or healing tool, practical armor-cloth mix, kind but sturdy presence, readable support role from mid-distance, single character, neutral pose, simple background, suitable for isometric auto-battler camera, static glb-ready model.
```

中文直投：

```text
风格化游戏战地医师，黎明阵营，暖琥珀色和白色主配色，辅助治疗角色，体型紧凑，带医疗罐或治疗工具，服装是实用轻甲与布料混合，气质可靠温和但不脆弱，中距离能看出是支援单位，适合自走棋 2.5D 俯视斜角镜头，单个角色，全身，标准站姿，背景干净，适合导出静态 glb 模型。
```

### Volt Juggler

```text
Stylized game-ready electric trickster caster, dusk-aligned skirmisher with violet and neon electric accents, asymmetric tech gear, energy baton or arc device silhouette, agile posture, flashy but readable shape language, high-energy mid-distance silhouette, single character, neutral pose, simple background, suitable for isometric auto-battler camera, static glb-ready model.
```

中文直投：

```text
风格化游戏电弧术士或杂耍者，黄昏阵营，紫色和霓虹电流点缀，不对称科技装备，使用电击短杖或放电装置，体态敏捷灵活，整体造型张扬但轮廓仍然清楚，中距离有很强识别度，适合自走棋 2.5D 俯视斜角镜头，单个角色，全身，标准站姿，背景干净，适合导出静态 glb 模型。
```

### Grave Warden

```text
Stylized game-ready undead fortress guardian, dusk-aligned heavy warden with stone-gray and muted crimson accents, tomb-guard silhouette, thick armor, anchor or mace weapon silhouette, imposing durable frontline read, single character, neutral pose, simple background, suitable for isometric auto-battler camera, static glb-ready model.
```

中文直投：

```text
风格化游戏墓垒守卫，黄昏阵营，石灰色和暗红色主配色，重型前排守卫，像陵墓守护者，护甲厚重，使用船锚、重锤或墓园感重武器，整体压迫感强，耐久感明显，适合自走棋 2.5D 俯视斜角镜头，单个角色，全身，标准站姿，背景干净，适合导出静态 glb 模型。
```

### Lumen Sentinel

```text
Stylized game-ready radiant sentinel, dawn-aligned defensive fighter with gold and pale cyan accents, shielded guardian silhouette, polished armor with luminous trims, disciplined protector presence, balanced tank-support read, single character, neutral pose, simple background, suitable for isometric auto-battler camera, static glb-ready model.
```

中文直投：

```text
风格化游戏辉光卫哨，黎明阵营，金色和浅青色主配色，带盾防守型角色，护甲整洁明亮，有发光边饰，气质像纪律严明的守护者，兼具坦度和辅助感，轮廓稳重清晰，适合自走棋 2.5D 俯视斜角镜头，单个角色，全身，标准站姿，背景干净，适合导出静态 glb 模型。
```

### Shade Runner

```text
Stylized game-ready shadow skirmisher, dusk-aligned fast backline diver with purple-black accents, sleek assassin silhouette, twin blades or compact shadow weapon profile, lean lower body, sharp high-speed read, readable from distance, single character, neutral pose, simple background, suitable for isometric auto-battler camera, static glb-ready model.
```

中文直投：

```text
风格化游戏暗影奔袭者，黄昏阵营，紫黑色主配色，高速切后排角色，刺客轮廓，使用双刀或紧凑暗影武器，身形轻快，腿部线条利落，整体有高速突袭感，远看也容易识别，适合自走棋 2.5D 俯视斜角镜头，单个角色，全身，标准站姿，背景干净，适合导出静态 glb 模型。
```

## Board Asset Prompts

### Main Board Ground

```text
Stylized modular auto-battler board ground, readable top-down and isometric presentation, sci-fi fantasy arena floor, clean tile segmentation, strong center play surface, restrained decoration, production-friendly geometry, static glb-ready environment piece.
```

中文直投：

```text
风格化模块化自走棋战场地面，适合俯视斜角镜头和中距离观看，科幻奇幻混合竞技场地板，格子分区清晰，中间主战区明确，装饰克制，不要过度复杂，适合导出静态 glb 场景件。
```

### Player Side Ground

```text
Stylized modular arena floor for player side, cleaner brighter faction mood, teal and cool neutral accents, readable deployment surface, low-clutter geometry, static glb-ready environment piece.
```

中文直投：

```text
风格化模块化玩家半场地面，整体更干净更明亮，青绿和冷灰色点缀，部署区域清晰，几何不要杂乱，适合俯视斜角镜头，适合导出静态 glb 场景件。
```

### Enemy Side Ground

```text
Stylized modular arena floor for enemy side, darker dusk-aligned mood, crimson and dark neutral accents, readable battle surface, low-clutter geometry, static glb-ready environment piece.
```

中文直投：

```text
风格化模块化敌方半场地面，整体更暗更有压迫感，暗红和深灰色点缀，战斗区域清晰，几何不要杂乱，适合俯视斜角镜头，适合导出静态 glb 场景件。
```

### Border Or Beacon Prop

```text
Stylized modular battle arena prop, readable from isometric gameplay camera, strong silhouette, low-clutter geometry, game-ready static glb prop, suitable for sci-fi fantasy auto-battler board dressing.
```

中文直投：

```text
风格化模块化战场装饰件，适合自走棋俯视斜角镜头观看，轮廓明确，结构简洁，不要太碎，适合作为科幻奇幻战场边框、信标、旗帜或装饰道具，适合导出静态 glb 模型。
```

## Review Rules

Reject a generation if:

- the weapon is unreadable at small size
- the silhouette collapses into a blob
- the unit looks too realistic relative to the game shell
- the shape language overlaps too much with another unit
- the top half is weak from the gameplay camera

Approve a generation if:

- you can tell role and faction in under two seconds
- the model remains readable when shrunk
- the head, shoulders, and weapon each contribute to identity
- the asset looks stable enough to export and test directly in `glb`
