# -*- coding: utf-8 -*-
"""
TerraForge — cria automaticamente o material do terreno (M_Terrain) e a
árvore das florestas (SM_Tree) a partir dos pacotes da Fab já adicionados
ao projeto (Pack03-LandscapePro e megaplant_library).

COMO USAR (uma vez):
1. Edit -> Plugins -> busque "Python" -> ative "Python Editor Script Plugin"
   -> reinicie o editor.
2. Menu Tools -> Execute Python Script... -> escolha este arquivo.
   (ou no console: py "C:/caminho/terraforge/Scripts/criar_material_terreno.py")
3. Veja o Output Log: as linhas [TerraForge] contam o que foi criado.
4. Aperte Play — o gerador de terreno detecta o M_Terrain e o SM_Tree sozinho.
"""

import unreal

DEST = "/Game/TerraForge"
LOG = "[TerraForge] "


def log(msg):
    unreal.log(LOG + msg)


def warn(msg):
    unreal.log_warning(LOG + msg)


# ---------------------------------------------------------------- texturas --

# Texturas técnicas que NUNCA devem ir no Base Color.
BAD_WORDS = ["_orm", "_mask", "rough", "_ao", "height", "disp", "opacity",
             "billboard", "_mt", "_ms", "_rma", "cavity", "spec"]

# Pastas preferidas (texturas de chão ficam no Landscape Pro, não no Megaplant).
PREFERRED = ["pack03", "landscapepro", "landscape"]


def all_assets():
    return unreal.EditorAssetLibrary.list_assets("/Game", recursive=True,
                                                 include_folder=False)


def find_texture(keywords, want_normal, assets):
    """Acha uma Texture2D pelo nome, validando o TIPO real no engine:
    normal maps têm compressão TC_Normalmap — infalível, independe do nome."""
    ranked = sorted(assets,
                    key=lambda p: 0 if any(f in p.lower() for f in PREFERRED)
                    else 1)
    for path in ranked:
        low = path.lower()
        name = low.split("/")[-1].split(".")[0]
        if not any(k in name for k in keywords):
            continue
        if any(b in name for b in BAD_WORDS):
            continue
        data = unreal.EditorAssetLibrary.find_asset_data(path)
        if data.asset_class_path.asset_name != "Texture2D":
            continue
        tex = unreal.EditorAssetLibrary.load_asset(path)
        if not tex:
            continue

        # Tipo REAL da textura, direto do asset:
        comp = tex.get_editor_property("compression_settings")
        is_normal = comp == unreal.TextureCompressionSettings.TC_NORMALMAP
        if is_normal != want_normal:
            continue
        if not want_normal:
            # Cor de verdade é sRGB; máscaras/dados técnicos são lineares.
            if not tex.get_editor_property("srgb"):
                continue
        return tex
    return None


# ------------------------------------------------------------------ helpers --

MEL = unreal.MaterialEditingLibrary


def expr(material, cls, x, y):
    return MEL.create_material_expression(material, cls, x, y)


def tex_sample(material, texture, x, y, is_normal=False):
    node = expr(material, unreal.MaterialExpressionTextureSample, x, y)
    node.set_editor_property("texture", texture)
    if is_normal:
        node.set_editor_property(
            "sampler_type", unreal.MaterialSamplerType.SAMPLERTYPE_NORMAL)
    return node


def smoothstep_chain(material, source, source_out, vmin, vmax, x, y):
    """Saturate((v - vmin) / (vmax - vmin)) com nós básicos (compatível)."""
    sub = expr(material, unreal.MaterialExpressionSubtract, x, y)
    c_min = expr(material, unreal.MaterialExpressionConstant, x - 150, y + 60)
    c_min.set_editor_property("r", vmin)
    MEL.connect_material_expressions(source, source_out, sub, "A")
    MEL.connect_material_expressions(c_min, "", sub, "B")

    div = expr(material, unreal.MaterialExpressionDivide, x + 150, y)
    c_range = expr(material, unreal.MaterialExpressionConstant, x, y + 120)
    c_range.set_editor_property("r", max(vmax - vmin, 0.001))
    MEL.connect_material_expressions(sub, "", div, "A")
    MEL.connect_material_expressions(c_range, "", div, "B")

    sat = expr(material, unreal.MaterialExpressionSaturate, x + 300, y)
    MEL.connect_material_expressions(div, "", sat, "")
    return sat


# ------------------------------------------------------------- M_Terrain ----

def create_terrain_material(assets):
    path = DEST + "/M_Terrain"
    if unreal.EditorAssetLibrary.does_asset_exist(path):
        log("M_Terrain existente será recriado com a nova seleção de texturas.")
        unreal.EditorAssetLibrary.delete_asset(path)

    grass_d = find_texture(["grass", "meadow", "ground"], False, assets)
    grass_n = find_texture(["grass", "meadow", "ground"], True, assets)
    rock_d = find_texture(["cliff", "rock", "stone", "slope"], False, assets)
    snow_d = find_texture(["snow"], False, assets)

    if not grass_d:
        warn("Nenhuma textura de grama encontrada — o material não foi criado. "
             "Confira se o Pack03-LandscapePro está no projeto.")
        return

    tools = unreal.AssetToolsHelpers.get_asset_tools()
    material = tools.create_asset("M_Terrain", DEST, unreal.Material,
                                  unreal.MaterialFactoryNew())

    # Base: grama.
    grass_node = tex_sample(material, grass_d, -900, 0)
    log("Grama: " + grass_d.get_name())
    base = grass_node
    base_out = "RGB"

    # Pedra nas encostas: inclinação = 1 - VertexNormalWS.Z.
    if rock_d:
        rock_node = tex_sample(material, rock_d, -900, 300)
        normal_ws = expr(material, unreal.MaterialExpressionVertexNormalWS,
                         -900, 600)
        mask_z = expr(material, unreal.MaterialExpressionComponentMask,
                      -750, 600)
        mask_z.set_editor_property("r", False)
        mask_z.set_editor_property("g", False)
        mask_z.set_editor_property("b", True)
        mask_z.set_editor_property("a", False)
        MEL.connect_material_expressions(normal_ws, "", mask_z, "")
        one_minus = expr(material, unreal.MaterialExpressionOneMinus, -600, 600)
        MEL.connect_material_expressions(mask_z, "", one_minus, "")
        slope = smoothstep_chain(material, one_minus, "", 0.25, 0.5, -450, 600)

        lerp_rock = expr(material, unreal.MaterialExpressionLinearInterpolate,
                         -300, 150)
        MEL.connect_material_expressions(base, base_out, lerp_rock, "A")
        MEL.connect_material_expressions(rock_node, "RGB", lerp_rock, "B")
        MEL.connect_material_expressions(slope, "", lerp_rock, "Alpha")
        base = lerp_rock
        base_out = ""
        log("Pedra nas encostas: " + rock_d.get_name())
    else:
        warn("Sem textura de pedra — encostas ficarão de grama.")

    # Neve nos picos: altura do mundo (Z) acima de ~1400.
    if snow_d:
        snow_node = tex_sample(material, snow_d, -900, 900)
        world_pos = expr(material, unreal.MaterialExpressionWorldPosition,
                         -900, 1200)
        mask_wz = expr(material, unreal.MaterialExpressionComponentMask,
                       -750, 1200)
        mask_wz.set_editor_property("r", False)
        mask_wz.set_editor_property("g", False)
        mask_wz.set_editor_property("b", True)
        mask_wz.set_editor_property("a", False)
        MEL.connect_material_expressions(world_pos, "", mask_wz, "")
        height = smoothstep_chain(material, mask_wz, "", 1400.0, 1800.0,
                                  -450, 1200)

        lerp_snow = expr(material, unreal.MaterialExpressionLinearInterpolate,
                         -100, 300)
        MEL.connect_material_expressions(base, base_out, lerp_snow, "A")
        MEL.connect_material_expressions(snow_node, "RGB", lerp_snow, "B")
        MEL.connect_material_expressions(height, "", lerp_snow, "Alpha")
        base = lerp_snow
        base_out = ""
        log("Neve nos picos: " + snow_d.get_name())
    else:
        warn("Sem textura de neve — picos ficarão como o resto.")

    MEL.connect_material_property(base, base_out,
                                  unreal.MaterialProperty.MP_BASE_COLOR)

    # Normal map da grama dá relevo fino ao chão inteiro.
    if grass_n:
        normal_node = tex_sample(material, grass_n, -900, -300, is_normal=True)
        MEL.connect_material_property(normal_node, "RGB",
                                      unreal.MaterialProperty.MP_NORMAL)
        log("Normal map: " + grass_n.get_name())

    MEL.recompile_material(material)
    unreal.EditorAssetLibrary.save_asset(path)
    log("M_Terrain criado e salvo em " + path + " ✔")


# --------------------------------------------------------------- SM_Tree ----

TREE_WORDS = ["tree", "alder", "birch", "oak", "maple", "pine", "spruce",
              "beech", "aspen", "poplar", "willow", "juniper", "fir"]


def create_tree(assets):
    dest_path = DEST + "/SM_Tree"
    if unreal.EditorAssetLibrary.does_asset_exist(dest_path):
        warn("SM_Tree já existe — pulando.")
        return

    candidates = []
    for path in assets:
        low = path.lower()
        if "megaplant" not in low:
            continue
        data = unreal.EditorAssetLibrary.find_asset_data(path)
        if data.asset_class_path.asset_name != "StaticMesh":
            continue
        name = path.split("/")[-1].split(".")[0].lower()
        if any(w in name for w in TREE_WORDS):
            candidates.insert(0, path)  # nomes de árvore têm prioridade
        else:
            candidates.append(path)

    if not candidates:
        warn("Nenhuma malha encontrada na megaplant_library — sem SM_Tree.")
        return

    # Entre até 40 candidatas, escolhe a mais ALTA (árvores >> arbustos).
    best_path, best_height = None, 0.0
    for path in candidates[:40]:
        mesh = unreal.EditorAssetLibrary.load_asset(path)
        if not mesh:
            continue
        box = mesh.get_bounding_box()
        height = box.max.z - box.min.z
        if height > best_height:
            best_height = height
            best_path = path

    if not best_path or best_height < 200.0:
        warn("Nenhuma planta alta o bastante para ser árvore (>2 m). "
             "Duplique manualmente uma árvore como /Game/TerraForge/SM_Tree.")
        return

    unreal.EditorAssetLibrary.duplicate_asset(best_path, dest_path)
    unreal.EditorAssetLibrary.save_asset(dest_path)
    log("SM_Tree criado a partir de %s (%.1f m de altura) ✔"
        % (best_path.split("/")[-1], best_height / 100.0))


# ------------------------------------------------------------------- main ----

def main():
    log("Procurando assets dos pacotes da Fab...")
    assets = all_assets()
    unreal.EditorAssetLibrary.make_directory(DEST)
    create_terrain_material(assets)
    create_tree(assets)
    log("Concluído! Aperte Play — o terreno e as florestas usam os novos "
        "assets automaticamente.")


main()
