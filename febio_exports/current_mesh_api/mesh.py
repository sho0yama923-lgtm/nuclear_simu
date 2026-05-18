# FEBio native mesh から生成した Gmsh Python API ブロックメッシュ。
# 手編集非推奨: native case JSON / generator options から再生成する。
# 編集ガイド:
# - geometry.gmshPythonApi.coordinateAliases は、生成される .geo/.py で読みやすい座標名を指定する。
#   生成ファイルでは数値由来の座標名より、cellLeftX / nucleusBottomZ / pipetteMouthX のような意味名を優先する。
# - geometry.gmshPythonApi.transfiniteCurveDivisions は、Python API 出力でブロック辺を何分割するかを指定する。
#   全ての transfinite curve を一様に細かくする場合は値を増やす。2 のままなら各ブロック辺は 1 要素相当になる。
# - DEFAULT_PHYSICAL_GROUP_REGISTRY は、FEBio 側で使う Gmsh Physical Group ID を固定する。
#   .msh の読み取りは Physical 名に依存するため、ID 変更は互換性移行として明示的に行う。
# - buildProjectGmshBlockLayout は、cytoplasm/nucleus/pipette/dish の箱と分割を読むための形状マップ。
#   ここで編集モデルを表し、下流の低レベル tag 出力では native 往復検証用の ID を保持する。
from pathlib import Path
import sys

for base in [Path(__file__).resolve(), Path.cwd().resolve()]:
    for parent in [base, *base.parents]:
        candidate = parent / ".tools" / "python-gmsh"
        if candidate.exists():
            sys.path.insert(0, str(candidate))
            break

try:
    import gmsh
except ModuleNotFoundError as exc:
    raise SystemExit("Python package 'gmsh' is required. Install the gmsh Python API matching the CLI before running this script.") from exc

SCRIPT_DIR = Path(__file__).resolve().parent
OUT_MSH = SCRIPT_DIR / "mesh.msh"
TRANSFINITE_CURVE_DIVISIONS = 2

def require_existing_entity_tags(dimension, name, tags):
    existing = {tag for _, tag in gmsh.model.getEntities(dimension)}
    missing = [tag for tag in tags if tag not in existing]
    if missing:
        raise SystemExit(f"Physical Group {dimension}:{name} references missing entity tag(s): {missing}")
    return tags

# 長方形ブロック配置で使う座標面。

# native case JSON / generator options から来る座標 alias。
cellLeftX = -26
cellRightX = 26
nucleusLeftX = -14
nucleusRightX = 14
pipetteMouthX = -6.5
pipetteOuterX = 6.5
pipetteYMax = 0.5
pipetteYMin = -0.5
dishBottomZ = -2.72
dishTopZ = 0
nucleusBottomZ = 8
pipettePatchZBottom = 26
pipettePatchZTop = 34
pipetteZTop = 47

PHYSICAL_VOLUMES = {
    "cytoplasm": [1,2,3,5,6,8,9,11,12,14,15,16],
    "dish": [4,7,10,13,17],
    "nucleus": [18,19,20],
    "pipette": [21,22],
}
PHYSICAL_SURFACES = {
    "cell_dish_surface": [20000,20022,20037,20052,20067],
    "cell_dish_left_surface": [20000],
    "cytoplasm_interface_surface": [20013,20023,20027,20038,20042,20053,20057,20080],
    "cytoplasm_interface_left_surface": [20013],
    "dish_contact_surface": [20017,20033,20048,20063,20082],
    "dish_contact_left_surface": [20017],
    "cell_dish_center_surface": [20022,20037,20052],
    "cytoplasm_interface_bottom_surface": [20023,20038,20053],
    "cytoplasm_interface_top_surface": [20027,20042,20057],
    "dish_contact_center_surface": [20033,20048,20063],
    "cell_dish_right_surface": [20067],
    "cytoplasm_interface_right_surface": [20080],
    "dish_contact_right_surface": [20082],
    "nucleus_interface_surface": [20086,20087,20091,20092,20093,20097,20098,20100],
    "nucleus_interface_bottom_surface": [20086,20092,20097],
    "nucleus_interface_top_surface": [20087,20093,20098],
    "nucleus_interface_left_surface": [20091],
    "pipette_suction_surface": [20093],
    "pipette_suction_patch": [20093],
    "nucleus_interface_right_surface": [20100],
    "pipette_contact_surface": [20102],
    "pipette_mouth_surface": [20102],
    "pipette_mouth_patch": [20102],
}
PHYSICAL_GROUP_IDS = {
    3: {
        "cytoplasm": 1,
        "dish": 4,
        "nucleus": 2,
        "pipette": 3,
    },
    2: {
        "cell_dish_surface": 101,
        "cell_dish_left_surface": 102,
        "cytoplasm_interface_surface": 114,
        "cytoplasm_interface_left_surface": 115,
        "dish_contact_surface": 105,
        "dish_contact_left_surface": 106,
        "cell_dish_center_surface": 103,
        "cytoplasm_interface_bottom_surface": 118,
        "cytoplasm_interface_top_surface": 117,
        "dish_contact_center_surface": 107,
        "cell_dish_right_surface": 104,
        "cytoplasm_interface_right_surface": 116,
        "dish_contact_right_surface": 108,
        "nucleus_interface_surface": 109,
        "nucleus_interface_bottom_surface": 113,
        "nucleus_interface_top_surface": 112,
        "nucleus_interface_left_surface": 110,
        "pipette_suction_surface": 119,
        "pipette_suction_patch": 120,
        "nucleus_interface_right_surface": 111,
        "pipette_contact_surface": 121,
        "pipette_mouth_surface": 122,
        "pipette_mouth_patch": 123,
    },
}

gmsh.initialize([arg for arg in sys.argv if arg != "--gui"])
gmsh.model.add("febio_native_parametric_block")
gmsh.option.setNumber("Mesh.MshFileVersion", 2.2)
gmsh.option.setNumber("Mesh.SaveAll", 0)
gmsh.option.setNumber("Mesh.RecombineAll", 1)

gmsh.model.geo.addPoint(cellLeftX, pipetteYMin, dishTopZ, 0, 1)
gmsh.model.geo.addPoint(nucleusLeftX, pipetteYMin, dishTopZ, 0, 2)
gmsh.model.geo.addPoint(nucleusLeftX, pipetteYMax, dishTopZ, 0, 3)
gmsh.model.geo.addPoint(cellLeftX, pipetteYMax, dishTopZ, 0, 4)
gmsh.model.geo.addPoint(cellLeftX, pipetteYMin, nucleusBottomZ, 0, 5)
gmsh.model.geo.addPoint(nucleusLeftX, pipetteYMin, nucleusBottomZ, 0, 6)
gmsh.model.geo.addPoint(nucleusLeftX, pipetteYMax, nucleusBottomZ, 0, 7)
gmsh.model.geo.addPoint(cellLeftX, pipetteYMax, nucleusBottomZ, 0, 8)
gmsh.model.geo.addPoint(cellLeftX, pipetteYMin, pipettePatchZBottom, 0, 9)
gmsh.model.geo.addPoint(nucleusLeftX, pipetteYMin, pipettePatchZBottom, 0, 10)
gmsh.model.geo.addPoint(nucleusLeftX, pipetteYMax, pipettePatchZBottom, 0, 11)
gmsh.model.geo.addPoint(cellLeftX, pipetteYMax, pipettePatchZBottom, 0, 12)
gmsh.model.geo.addPoint(cellLeftX, pipetteYMin, pipettePatchZTop, 0, 13)
gmsh.model.geo.addPoint(nucleusLeftX, pipetteYMin, pipettePatchZTop, 0, 14)
gmsh.model.geo.addPoint(nucleusLeftX, pipetteYMax, pipettePatchZTop, 0, 15)
gmsh.model.geo.addPoint(cellLeftX, pipetteYMax, pipettePatchZTop, 0, 16)
gmsh.model.geo.addPoint(cellLeftX, pipetteYMin, dishBottomZ, 0, 17)
gmsh.model.geo.addPoint(nucleusLeftX, pipetteYMin, dishBottomZ, 0, 18)
gmsh.model.geo.addPoint(nucleusLeftX, pipetteYMax, dishBottomZ, 0, 19)
gmsh.model.geo.addPoint(cellLeftX, pipetteYMax, dishBottomZ, 0, 20)
gmsh.model.geo.addPoint(cellLeftX, pipetteYMin, dishTopZ, 0, 21)
gmsh.model.geo.addPoint(nucleusLeftX, pipetteYMin, dishTopZ, 0, 22)
gmsh.model.geo.addPoint(nucleusLeftX, pipetteYMax, dishTopZ, 0, 23)
gmsh.model.geo.addPoint(cellLeftX, pipetteYMax, dishTopZ, 0, 24)
gmsh.model.geo.addPoint(pipetteMouthX, pipetteYMin, dishTopZ, 0, 25)
gmsh.model.geo.addPoint(pipetteMouthX, pipetteYMax, dishTopZ, 0, 26)
gmsh.model.geo.addPoint(pipetteMouthX, pipetteYMin, nucleusBottomZ, 0, 27)
gmsh.model.geo.addPoint(pipetteMouthX, pipetteYMax, nucleusBottomZ, 0, 28)
gmsh.model.geo.addPoint(pipetteMouthX, pipetteYMin, pipettePatchZBottom, 0, 29)
gmsh.model.geo.addPoint(pipetteMouthX, pipetteYMax, pipettePatchZBottom, 0, 30)
gmsh.model.geo.addPoint(pipetteMouthX, pipetteYMin, pipettePatchZTop, 0, 31)
gmsh.model.geo.addPoint(pipetteMouthX, pipetteYMax, pipettePatchZTop, 0, 32)
gmsh.model.geo.addPoint(pipetteMouthX, pipetteYMin, dishBottomZ, 0, 33)
gmsh.model.geo.addPoint(pipetteMouthX, pipetteYMax, dishBottomZ, 0, 34)
gmsh.model.geo.addPoint(pipetteMouthX, pipetteYMin, dishTopZ, 0, 35)
gmsh.model.geo.addPoint(pipetteMouthX, pipetteYMax, dishTopZ, 0, 36)
gmsh.model.geo.addPoint(pipetteOuterX, pipetteYMin, dishTopZ, 0, 37)
gmsh.model.geo.addPoint(pipetteOuterX, pipetteYMax, dishTopZ, 0, 38)
gmsh.model.geo.addPoint(pipetteOuterX, pipetteYMin, nucleusBottomZ, 0, 39)
gmsh.model.geo.addPoint(pipetteOuterX, pipetteYMax, nucleusBottomZ, 0, 40)
gmsh.model.geo.addPoint(pipetteOuterX, pipetteYMin, pipettePatchZBottom, 0, 41)
gmsh.model.geo.addPoint(pipetteOuterX, pipetteYMax, pipettePatchZBottom, 0, 42)
gmsh.model.geo.addPoint(pipetteOuterX, pipetteYMin, pipettePatchZTop, 0, 43)
gmsh.model.geo.addPoint(pipetteOuterX, pipetteYMax, pipettePatchZTop, 0, 44)
gmsh.model.geo.addPoint(pipetteOuterX, pipetteYMin, dishBottomZ, 0, 45)
gmsh.model.geo.addPoint(pipetteOuterX, pipetteYMax, dishBottomZ, 0, 46)
gmsh.model.geo.addPoint(pipetteOuterX, pipetteYMin, dishTopZ, 0, 47)
gmsh.model.geo.addPoint(pipetteOuterX, pipetteYMax, dishTopZ, 0, 48)
gmsh.model.geo.addPoint(nucleusRightX, pipetteYMin, dishTopZ, 0, 49)
gmsh.model.geo.addPoint(nucleusRightX, pipetteYMax, dishTopZ, 0, 50)
gmsh.model.geo.addPoint(nucleusRightX, pipetteYMin, nucleusBottomZ, 0, 51)
gmsh.model.geo.addPoint(nucleusRightX, pipetteYMax, nucleusBottomZ, 0, 52)
gmsh.model.geo.addPoint(nucleusRightX, pipetteYMin, pipettePatchZBottom, 0, 53)
gmsh.model.geo.addPoint(nucleusRightX, pipetteYMax, pipettePatchZBottom, 0, 54)
gmsh.model.geo.addPoint(nucleusRightX, pipetteYMin, pipettePatchZTop, 0, 55)
gmsh.model.geo.addPoint(nucleusRightX, pipetteYMax, pipettePatchZTop, 0, 56)
gmsh.model.geo.addPoint(nucleusRightX, pipetteYMin, dishBottomZ, 0, 57)
gmsh.model.geo.addPoint(nucleusRightX, pipetteYMax, dishBottomZ, 0, 58)
gmsh.model.geo.addPoint(nucleusRightX, pipetteYMin, dishTopZ, 0, 59)
gmsh.model.geo.addPoint(nucleusRightX, pipetteYMax, dishTopZ, 0, 60)
gmsh.model.geo.addPoint(cellRightX, pipetteYMin, dishTopZ, 0, 61)
gmsh.model.geo.addPoint(cellRightX, pipetteYMax, dishTopZ, 0, 62)
gmsh.model.geo.addPoint(cellRightX, pipetteYMin, nucleusBottomZ, 0, 63)
gmsh.model.geo.addPoint(cellRightX, pipetteYMax, nucleusBottomZ, 0, 64)
gmsh.model.geo.addPoint(cellRightX, pipetteYMin, pipettePatchZBottom, 0, 65)
gmsh.model.geo.addPoint(cellRightX, pipetteYMax, pipettePatchZBottom, 0, 66)
gmsh.model.geo.addPoint(cellRightX, pipetteYMin, pipettePatchZTop, 0, 67)
gmsh.model.geo.addPoint(cellRightX, pipetteYMax, pipettePatchZTop, 0, 68)
gmsh.model.geo.addPoint(cellRightX, pipetteYMin, dishBottomZ, 0, 69)
gmsh.model.geo.addPoint(cellRightX, pipetteYMax, dishBottomZ, 0, 70)
gmsh.model.geo.addPoint(cellRightX, pipetteYMin, dishTopZ, 0, 71)
gmsh.model.geo.addPoint(cellRightX, pipetteYMax, dishTopZ, 0, 72)
gmsh.model.geo.addPoint(nucleusLeftX, pipetteYMin, nucleusBottomZ, 0, 73)
gmsh.model.geo.addPoint(pipetteMouthX, pipetteYMin, nucleusBottomZ, 0, 74)
gmsh.model.geo.addPoint(pipetteMouthX, pipetteYMax, nucleusBottomZ, 0, 75)
gmsh.model.geo.addPoint(nucleusLeftX, pipetteYMax, nucleusBottomZ, 0, 76)
gmsh.model.geo.addPoint(nucleusLeftX, pipetteYMin, pipettePatchZBottom, 0, 77)
gmsh.model.geo.addPoint(pipetteMouthX, pipetteYMin, pipettePatchZBottom, 0, 78)
gmsh.model.geo.addPoint(pipetteMouthX, pipetteYMax, pipettePatchZBottom, 0, 79)
gmsh.model.geo.addPoint(nucleusLeftX, pipetteYMax, pipettePatchZBottom, 0, 80)
gmsh.model.geo.addPoint(pipetteOuterX, pipetteYMin, nucleusBottomZ, 0, 81)
gmsh.model.geo.addPoint(pipetteOuterX, pipetteYMax, nucleusBottomZ, 0, 82)
gmsh.model.geo.addPoint(pipetteOuterX, pipetteYMin, pipettePatchZBottom, 0, 83)
gmsh.model.geo.addPoint(pipetteOuterX, pipetteYMax, pipettePatchZBottom, 0, 84)
gmsh.model.geo.addPoint(nucleusRightX, pipetteYMin, nucleusBottomZ, 0, 85)
gmsh.model.geo.addPoint(nucleusRightX, pipetteYMax, nucleusBottomZ, 0, 86)
gmsh.model.geo.addPoint(nucleusRightX, pipetteYMin, pipettePatchZBottom, 0, 87)
gmsh.model.geo.addPoint(nucleusRightX, pipetteYMax, pipettePatchZBottom, 0, 88)
gmsh.model.geo.addPoint(pipetteMouthX, pipetteYMin, pipettePatchZBottom, 0, 89)
gmsh.model.geo.addPoint(pipetteOuterX, pipetteYMin, pipettePatchZBottom, 0, 90)
gmsh.model.geo.addPoint(pipetteOuterX, pipetteYMax, pipettePatchZBottom, 0, 91)
gmsh.model.geo.addPoint(pipetteMouthX, pipetteYMax, pipettePatchZBottom, 0, 92)
gmsh.model.geo.addPoint(pipetteMouthX, pipetteYMin, pipettePatchZTop, 0, 93)
gmsh.model.geo.addPoint(pipetteOuterX, pipetteYMin, pipettePatchZTop, 0, 94)
gmsh.model.geo.addPoint(pipetteOuterX, pipetteYMax, pipettePatchZTop, 0, 95)
gmsh.model.geo.addPoint(pipetteMouthX, pipetteYMax, pipettePatchZTop, 0, 96)
gmsh.model.geo.addPoint(pipetteMouthX, pipetteYMin, pipetteZTop, 0, 97)
gmsh.model.geo.addPoint(pipetteOuterX, pipetteYMin, pipetteZTop, 0, 98)
gmsh.model.geo.addPoint(pipetteOuterX, pipetteYMax, pipetteZTop, 0, 99)
gmsh.model.geo.addPoint(pipetteMouthX, pipetteYMax, pipetteZTop, 0, 100)

gmsh.model.geo.addLine(1, 4, 10000)
gmsh.model.geo.addLine(4, 3, 10001)
gmsh.model.geo.addLine(3, 2, 10002)
gmsh.model.geo.addLine(2, 1, 10003)
gmsh.model.geo.addLine(5, 6, 10004)
gmsh.model.geo.addLine(6, 7, 10005)
gmsh.model.geo.addLine(7, 8, 10006)
gmsh.model.geo.addLine(8, 5, 10007)
gmsh.model.geo.addLine(2, 6, 10008)
gmsh.model.geo.addLine(5, 1, 10009)
gmsh.model.geo.addLine(3, 7, 10010)
gmsh.model.geo.addLine(4, 8, 10011)
gmsh.model.geo.addLine(9, 12, 10012)
gmsh.model.geo.addLine(12, 11, 10013)
gmsh.model.geo.addLine(11, 10, 10014)
gmsh.model.geo.addLine(10, 9, 10015)
gmsh.model.geo.addLine(13, 14, 10016)
gmsh.model.geo.addLine(14, 15, 10017)
gmsh.model.geo.addLine(15, 16, 10018)
gmsh.model.geo.addLine(16, 13, 10019)
gmsh.model.geo.addLine(10, 14, 10020)
gmsh.model.geo.addLine(13, 9, 10021)
gmsh.model.geo.addLine(11, 15, 10022)
gmsh.model.geo.addLine(12, 16, 10023)
gmsh.model.geo.addLine(6, 10, 10024)
gmsh.model.geo.addLine(9, 5, 10025)
gmsh.model.geo.addLine(7, 11, 10026)
gmsh.model.geo.addLine(8, 12, 10027)
gmsh.model.geo.addLine(17, 20, 10028)
gmsh.model.geo.addLine(20, 19, 10029)
gmsh.model.geo.addLine(19, 18, 10030)
gmsh.model.geo.addLine(18, 17, 10031)
gmsh.model.geo.addLine(21, 22, 10032)
gmsh.model.geo.addLine(22, 23, 10033)
gmsh.model.geo.addLine(23, 24, 10034)
gmsh.model.geo.addLine(24, 21, 10035)
gmsh.model.geo.addLine(18, 22, 10036)
gmsh.model.geo.addLine(21, 17, 10037)
gmsh.model.geo.addLine(19, 23, 10038)
gmsh.model.geo.addLine(20, 24, 10039)
gmsh.model.geo.addLine(3, 26, 10040)
gmsh.model.geo.addLine(26, 25, 10041)
gmsh.model.geo.addLine(25, 2, 10042)
gmsh.model.geo.addLine(6, 27, 10043)
gmsh.model.geo.addLine(27, 28, 10044)
gmsh.model.geo.addLine(28, 7, 10045)
gmsh.model.geo.addLine(25, 27, 10046)
gmsh.model.geo.addLine(26, 28, 10047)
gmsh.model.geo.addLine(11, 30, 10048)
gmsh.model.geo.addLine(30, 29, 10049)
gmsh.model.geo.addLine(29, 10, 10050)
gmsh.model.geo.addLine(14, 31, 10051)
gmsh.model.geo.addLine(31, 32, 10052)
gmsh.model.geo.addLine(32, 15, 10053)
gmsh.model.geo.addLine(29, 31, 10054)
gmsh.model.geo.addLine(30, 32, 10055)
gmsh.model.geo.addLine(19, 34, 10056)
gmsh.model.geo.addLine(34, 33, 10057)
gmsh.model.geo.addLine(33, 18, 10058)
gmsh.model.geo.addLine(22, 35, 10059)
gmsh.model.geo.addLine(35, 36, 10060)
gmsh.model.geo.addLine(36, 23, 10061)
gmsh.model.geo.addLine(33, 35, 10062)
gmsh.model.geo.addLine(34, 36, 10063)
gmsh.model.geo.addLine(26, 38, 10064)
gmsh.model.geo.addLine(38, 37, 10065)
gmsh.model.geo.addLine(37, 25, 10066)
gmsh.model.geo.addLine(27, 39, 10067)
gmsh.model.geo.addLine(39, 40, 10068)
gmsh.model.geo.addLine(40, 28, 10069)
gmsh.model.geo.addLine(37, 39, 10070)
gmsh.model.geo.addLine(38, 40, 10071)
gmsh.model.geo.addLine(30, 42, 10072)
gmsh.model.geo.addLine(42, 41, 10073)
gmsh.model.geo.addLine(41, 29, 10074)
gmsh.model.geo.addLine(31, 43, 10075)
gmsh.model.geo.addLine(43, 44, 10076)
gmsh.model.geo.addLine(44, 32, 10077)
gmsh.model.geo.addLine(41, 43, 10078)
gmsh.model.geo.addLine(42, 44, 10079)
gmsh.model.geo.addLine(34, 46, 10080)
gmsh.model.geo.addLine(46, 45, 10081)
gmsh.model.geo.addLine(45, 33, 10082)
gmsh.model.geo.addLine(35, 47, 10083)
gmsh.model.geo.addLine(47, 48, 10084)
gmsh.model.geo.addLine(48, 36, 10085)
gmsh.model.geo.addLine(45, 47, 10086)
gmsh.model.geo.addLine(46, 48, 10087)
gmsh.model.geo.addLine(38, 50, 10088)
gmsh.model.geo.addLine(50, 49, 10089)
gmsh.model.geo.addLine(49, 37, 10090)
gmsh.model.geo.addLine(39, 51, 10091)
gmsh.model.geo.addLine(51, 52, 10092)
gmsh.model.geo.addLine(52, 40, 10093)
gmsh.model.geo.addLine(49, 51, 10094)
gmsh.model.geo.addLine(50, 52, 10095)
gmsh.model.geo.addLine(42, 54, 10096)
gmsh.model.geo.addLine(54, 53, 10097)
gmsh.model.geo.addLine(53, 41, 10098)
gmsh.model.geo.addLine(43, 55, 10099)
gmsh.model.geo.addLine(55, 56, 10100)
gmsh.model.geo.addLine(56, 44, 10101)
gmsh.model.geo.addLine(53, 55, 10102)
gmsh.model.geo.addLine(54, 56, 10103)
gmsh.model.geo.addLine(46, 58, 10104)
gmsh.model.geo.addLine(58, 57, 10105)
gmsh.model.geo.addLine(57, 45, 10106)
gmsh.model.geo.addLine(47, 59, 10107)
gmsh.model.geo.addLine(59, 60, 10108)
gmsh.model.geo.addLine(60, 48, 10109)
gmsh.model.geo.addLine(57, 59, 10110)
gmsh.model.geo.addLine(58, 60, 10111)
gmsh.model.geo.addLine(50, 62, 10112)
gmsh.model.geo.addLine(62, 61, 10113)
gmsh.model.geo.addLine(61, 49, 10114)
gmsh.model.geo.addLine(51, 63, 10115)
gmsh.model.geo.addLine(63, 64, 10116)
gmsh.model.geo.addLine(64, 52, 10117)
gmsh.model.geo.addLine(61, 63, 10118)
gmsh.model.geo.addLine(62, 64, 10119)
gmsh.model.geo.addLine(54, 66, 10120)
gmsh.model.geo.addLine(66, 65, 10121)
gmsh.model.geo.addLine(65, 53, 10122)
gmsh.model.geo.addLine(55, 67, 10123)
gmsh.model.geo.addLine(67, 68, 10124)
gmsh.model.geo.addLine(68, 56, 10125)
gmsh.model.geo.addLine(65, 67, 10126)
gmsh.model.geo.addLine(66, 68, 10127)
gmsh.model.geo.addLine(63, 65, 10128)
gmsh.model.geo.addLine(53, 51, 10129)
gmsh.model.geo.addLine(64, 66, 10130)
gmsh.model.geo.addLine(52, 54, 10131)
gmsh.model.geo.addLine(58, 70, 10132)
gmsh.model.geo.addLine(70, 69, 10133)
gmsh.model.geo.addLine(69, 57, 10134)
gmsh.model.geo.addLine(59, 71, 10135)
gmsh.model.geo.addLine(71, 72, 10136)
gmsh.model.geo.addLine(72, 60, 10137)
gmsh.model.geo.addLine(69, 71, 10138)
gmsh.model.geo.addLine(70, 72, 10139)
gmsh.model.geo.addLine(73, 76, 10140)
gmsh.model.geo.addLine(76, 75, 10141)
gmsh.model.geo.addLine(75, 74, 10142)
gmsh.model.geo.addLine(74, 73, 10143)
gmsh.model.geo.addLine(77, 78, 10144)
gmsh.model.geo.addLine(78, 79, 10145)
gmsh.model.geo.addLine(79, 80, 10146)
gmsh.model.geo.addLine(80, 77, 10147)
gmsh.model.geo.addLine(74, 78, 10148)
gmsh.model.geo.addLine(77, 73, 10149)
gmsh.model.geo.addLine(75, 79, 10150)
gmsh.model.geo.addLine(76, 80, 10151)
gmsh.model.geo.addLine(75, 82, 10152)
gmsh.model.geo.addLine(82, 81, 10153)
gmsh.model.geo.addLine(81, 74, 10154)
gmsh.model.geo.addLine(78, 83, 10155)
gmsh.model.geo.addLine(83, 84, 10156)
gmsh.model.geo.addLine(84, 79, 10157)
gmsh.model.geo.addLine(81, 83, 10158)
gmsh.model.geo.addLine(82, 84, 10159)
gmsh.model.geo.addLine(82, 86, 10160)
gmsh.model.geo.addLine(86, 85, 10161)
gmsh.model.geo.addLine(85, 81, 10162)
gmsh.model.geo.addLine(83, 87, 10163)
gmsh.model.geo.addLine(87, 88, 10164)
gmsh.model.geo.addLine(88, 84, 10165)
gmsh.model.geo.addLine(85, 87, 10166)
gmsh.model.geo.addLine(86, 88, 10167)
gmsh.model.geo.addLine(89, 92, 10168)
gmsh.model.geo.addLine(92, 91, 10169)
gmsh.model.geo.addLine(91, 90, 10170)
gmsh.model.geo.addLine(90, 89, 10171)
gmsh.model.geo.addLine(93, 94, 10172)
gmsh.model.geo.addLine(94, 95, 10173)
gmsh.model.geo.addLine(95, 96, 10174)
gmsh.model.geo.addLine(96, 93, 10175)
gmsh.model.geo.addLine(90, 94, 10176)
gmsh.model.geo.addLine(93, 89, 10177)
gmsh.model.geo.addLine(91, 95, 10178)
gmsh.model.geo.addLine(92, 96, 10179)
gmsh.model.geo.addLine(97, 98, 10180)
gmsh.model.geo.addLine(98, 99, 10181)
gmsh.model.geo.addLine(99, 100, 10182)
gmsh.model.geo.addLine(100, 97, 10183)
gmsh.model.geo.addLine(94, 98, 10184)
gmsh.model.geo.addLine(97, 93, 10185)
gmsh.model.geo.addLine(95, 99, 10186)
gmsh.model.geo.addLine(96, 100, 10187)

gmsh.model.geo.addCurveLoop([10000,10001,10002,10003], 20000)
gmsh.model.geo.addPlaneSurface([20000], 20000)  # 所有要素 1
gmsh.model.geo.addCurveLoop([10004,10005,10006,10007], 20001)
gmsh.model.geo.addPlaneSurface([20001], 20001)  # 所有要素 1
gmsh.model.geo.addCurveLoop([-10003,10008,-10004,10009], 20002)
gmsh.model.geo.addPlaneSurface([20002], 20002)  # 所有要素 1
gmsh.model.geo.addCurveLoop([-10002,10010,-10005,-10008], 20003)
gmsh.model.geo.addPlaneSurface([20003], 20003)  # 所有要素 1
gmsh.model.geo.addCurveLoop([-10001,10011,-10006,-10010], 20004)
gmsh.model.geo.addPlaneSurface([20004], 20004)  # 所有要素 1
gmsh.model.geo.addCurveLoop([-10000,-10009,-10007,-10011], 20005)
gmsh.model.geo.addPlaneSurface([20005], 20005)  # 所有要素 1
gmsh.model.geo.addCurveLoop([10012,10013,10014,10015], 20006)
gmsh.model.geo.addPlaneSurface([20006], 20006)  # 所有要素 2
gmsh.model.geo.addCurveLoop([10016,10017,10018,10019], 20007)
gmsh.model.geo.addPlaneSurface([20007], 20007)  # 所有要素 2
gmsh.model.geo.addCurveLoop([-10015,10020,-10016,10021], 20008)
gmsh.model.geo.addPlaneSurface([20008], 20008)  # 所有要素 2
gmsh.model.geo.addCurveLoop([-10014,10022,-10017,-10020], 20009)
gmsh.model.geo.addPlaneSurface([20009], 20009)  # 所有要素 2
gmsh.model.geo.addCurveLoop([-10013,10023,-10018,-10022], 20010)
gmsh.model.geo.addPlaneSurface([20010], 20010)  # 所有要素 2
gmsh.model.geo.addCurveLoop([-10012,-10021,-10019,-10023], 20011)
gmsh.model.geo.addPlaneSurface([20011], 20011)  # 所有要素 2
gmsh.model.geo.addCurveLoop([10004,10024,10015,10025], 20012)
gmsh.model.geo.addPlaneSurface([20012], 20012)  # 所有要素 3
gmsh.model.geo.addCurveLoop([10005,10026,10014,-10024], 20013)
gmsh.model.geo.addPlaneSurface([20013], 20013)  # 所有要素 3
gmsh.model.geo.addCurveLoop([10006,10027,10013,-10026], 20014)
gmsh.model.geo.addPlaneSurface([20014], 20014)  # 所有要素 3
gmsh.model.geo.addCurveLoop([10007,-10025,10012,-10027], 20015)
gmsh.model.geo.addPlaneSurface([20015], 20015)  # 所有要素 3
gmsh.model.geo.addCurveLoop([10028,10029,10030,10031], 20016)
gmsh.model.geo.addPlaneSurface([20016], 20016)  # 所有要素 4
gmsh.model.geo.addCurveLoop([10032,10033,10034,10035], 20017)
gmsh.model.geo.addPlaneSurface([20017], 20017)  # 所有要素 4
gmsh.model.geo.addCurveLoop([-10031,10036,-10032,10037], 20018)
gmsh.model.geo.addPlaneSurface([20018], 20018)  # 所有要素 4
gmsh.model.geo.addCurveLoop([-10030,10038,-10033,-10036], 20019)
gmsh.model.geo.addPlaneSurface([20019], 20019)  # 所有要素 4
gmsh.model.geo.addCurveLoop([-10029,10039,-10034,-10038], 20020)
gmsh.model.geo.addPlaneSurface([20020], 20020)  # 所有要素 4
gmsh.model.geo.addCurveLoop([-10028,-10037,-10035,-10039], 20021)
gmsh.model.geo.addPlaneSurface([20021], 20021)  # 所有要素 4
gmsh.model.geo.addCurveLoop([-10002,10040,10041,10042], 20022)
gmsh.model.geo.addPlaneSurface([20022], 20022)  # 所有要素 5
gmsh.model.geo.addCurveLoop([10043,10044,10045,-10005], 20023)
gmsh.model.geo.addPlaneSurface([20023], 20023)  # 所有要素 5
gmsh.model.geo.addCurveLoop([-10042,10046,-10043,-10008], 20024)
gmsh.model.geo.addPlaneSurface([20024], 20024)  # 所有要素 5
gmsh.model.geo.addCurveLoop([-10041,10047,-10044,-10046], 20025)
gmsh.model.geo.addPlaneSurface([20025], 20025)  # 所有要素 5
gmsh.model.geo.addCurveLoop([-10040,10010,-10045,-10047], 20026)
gmsh.model.geo.addPlaneSurface([20026], 20026)  # 所有要素 5
gmsh.model.geo.addCurveLoop([-10014,10048,10049,10050], 20027)
gmsh.model.geo.addPlaneSurface([20027], 20027)  # 所有要素 6
gmsh.model.geo.addCurveLoop([10051,10052,10053,-10017], 20028)
gmsh.model.geo.addPlaneSurface([20028], 20028)  # 所有要素 6
gmsh.model.geo.addCurveLoop([-10050,10054,-10051,-10020], 20029)
gmsh.model.geo.addPlaneSurface([20029], 20029)  # 所有要素 6
gmsh.model.geo.addCurveLoop([-10049,10055,-10052,-10054], 20030)
gmsh.model.geo.addPlaneSurface([20030], 20030)  # 所有要素 6
gmsh.model.geo.addCurveLoop([-10048,10022,-10053,-10055], 20031)
gmsh.model.geo.addPlaneSurface([20031], 20031)  # 所有要素 6
gmsh.model.geo.addCurveLoop([-10030,10056,10057,10058], 20032)
gmsh.model.geo.addPlaneSurface([20032], 20032)  # 所有要素 7
gmsh.model.geo.addCurveLoop([10059,10060,10061,-10033], 20033)
gmsh.model.geo.addPlaneSurface([20033], 20033)  # 所有要素 7
gmsh.model.geo.addCurveLoop([-10058,10062,-10059,-10036], 20034)
gmsh.model.geo.addPlaneSurface([20034], 20034)  # 所有要素 7
gmsh.model.geo.addCurveLoop([-10057,10063,-10060,-10062], 20035)
gmsh.model.geo.addPlaneSurface([20035], 20035)  # 所有要素 7
gmsh.model.geo.addCurveLoop([-10056,10038,-10061,-10063], 20036)
gmsh.model.geo.addPlaneSurface([20036], 20036)  # 所有要素 7
gmsh.model.geo.addCurveLoop([-10041,10064,10065,10066], 20037)
gmsh.model.geo.addPlaneSurface([20037], 20037)  # 所有要素 8
gmsh.model.geo.addCurveLoop([10067,10068,10069,-10044], 20038)
gmsh.model.geo.addPlaneSurface([20038], 20038)  # 所有要素 8
gmsh.model.geo.addCurveLoop([-10066,10070,-10067,-10046], 20039)
gmsh.model.geo.addPlaneSurface([20039], 20039)  # 所有要素 8
gmsh.model.geo.addCurveLoop([-10065,10071,-10068,-10070], 20040)
gmsh.model.geo.addPlaneSurface([20040], 20040)  # 所有要素 8
gmsh.model.geo.addCurveLoop([-10064,10047,-10069,-10071], 20041)
gmsh.model.geo.addPlaneSurface([20041], 20041)  # 所有要素 8
gmsh.model.geo.addCurveLoop([-10049,10072,10073,10074], 20042)
gmsh.model.geo.addPlaneSurface([20042], 20042)  # 所有要素 9
gmsh.model.geo.addCurveLoop([10075,10076,10077,-10052], 20043)
gmsh.model.geo.addPlaneSurface([20043], 20043)  # 所有要素 9
gmsh.model.geo.addCurveLoop([-10074,10078,-10075,-10054], 20044)
gmsh.model.geo.addPlaneSurface([20044], 20044)  # 所有要素 9
gmsh.model.geo.addCurveLoop([-10073,10079,-10076,-10078], 20045)
gmsh.model.geo.addPlaneSurface([20045], 20045)  # 所有要素 9
gmsh.model.geo.addCurveLoop([-10072,10055,-10077,-10079], 20046)
gmsh.model.geo.addPlaneSurface([20046], 20046)  # 所有要素 9
gmsh.model.geo.addCurveLoop([-10057,10080,10081,10082], 20047)
gmsh.model.geo.addPlaneSurface([20047], 20047)  # 所有要素 10
gmsh.model.geo.addCurveLoop([10083,10084,10085,-10060], 20048)
gmsh.model.geo.addPlaneSurface([20048], 20048)  # 所有要素 10
gmsh.model.geo.addCurveLoop([-10082,10086,-10083,-10062], 20049)
gmsh.model.geo.addPlaneSurface([20049], 20049)  # 所有要素 10
gmsh.model.geo.addCurveLoop([-10081,10087,-10084,-10086], 20050)
gmsh.model.geo.addPlaneSurface([20050], 20050)  # 所有要素 10
gmsh.model.geo.addCurveLoop([-10080,10063,-10085,-10087], 20051)
gmsh.model.geo.addPlaneSurface([20051], 20051)  # 所有要素 10
gmsh.model.geo.addCurveLoop([-10065,10088,10089,10090], 20052)
gmsh.model.geo.addPlaneSurface([20052], 20052)  # 所有要素 11
gmsh.model.geo.addCurveLoop([10091,10092,10093,-10068], 20053)
gmsh.model.geo.addPlaneSurface([20053], 20053)  # 所有要素 11
gmsh.model.geo.addCurveLoop([-10090,10094,-10091,-10070], 20054)
gmsh.model.geo.addPlaneSurface([20054], 20054)  # 所有要素 11
gmsh.model.geo.addCurveLoop([-10089,10095,-10092,-10094], 20055)
gmsh.model.geo.addPlaneSurface([20055], 20055)  # 所有要素 11
gmsh.model.geo.addCurveLoop([-10088,10071,-10093,-10095], 20056)
gmsh.model.geo.addPlaneSurface([20056], 20056)  # 所有要素 11
gmsh.model.geo.addCurveLoop([-10073,10096,10097,10098], 20057)
gmsh.model.geo.addPlaneSurface([20057], 20057)  # 所有要素 12
gmsh.model.geo.addCurveLoop([10099,10100,10101,-10076], 20058)
gmsh.model.geo.addPlaneSurface([20058], 20058)  # 所有要素 12
gmsh.model.geo.addCurveLoop([-10098,10102,-10099,-10078], 20059)
gmsh.model.geo.addPlaneSurface([20059], 20059)  # 所有要素 12
gmsh.model.geo.addCurveLoop([-10097,10103,-10100,-10102], 20060)
gmsh.model.geo.addPlaneSurface([20060], 20060)  # 所有要素 12
gmsh.model.geo.addCurveLoop([-10096,10079,-10101,-10103], 20061)
gmsh.model.geo.addPlaneSurface([20061], 20061)  # 所有要素 12
gmsh.model.geo.addCurveLoop([-10081,10104,10105,10106], 20062)
gmsh.model.geo.addPlaneSurface([20062], 20062)  # 所有要素 13
gmsh.model.geo.addCurveLoop([10107,10108,10109,-10084], 20063)
gmsh.model.geo.addPlaneSurface([20063], 20063)  # 所有要素 13
gmsh.model.geo.addCurveLoop([-10106,10110,-10107,-10086], 20064)
gmsh.model.geo.addPlaneSurface([20064], 20064)  # 所有要素 13
gmsh.model.geo.addCurveLoop([-10105,10111,-10108,-10110], 20065)
gmsh.model.geo.addPlaneSurface([20065], 20065)  # 所有要素 13
gmsh.model.geo.addCurveLoop([-10104,10087,-10109,-10111], 20066)
gmsh.model.geo.addPlaneSurface([20066], 20066)  # 所有要素 13
gmsh.model.geo.addCurveLoop([-10089,10112,10113,10114], 20067)
gmsh.model.geo.addPlaneSurface([20067], 20067)  # 所有要素 14
gmsh.model.geo.addCurveLoop([10115,10116,10117,-10092], 20068)
gmsh.model.geo.addPlaneSurface([20068], 20068)  # 所有要素 14
gmsh.model.geo.addCurveLoop([-10114,10118,-10115,-10094], 20069)
gmsh.model.geo.addPlaneSurface([20069], 20069)  # 所有要素 14
gmsh.model.geo.addCurveLoop([-10113,10119,-10116,-10118], 20070)
gmsh.model.geo.addPlaneSurface([20070], 20070)  # 所有要素 14
gmsh.model.geo.addCurveLoop([-10112,10095,-10117,-10119], 20071)
gmsh.model.geo.addPlaneSurface([20071], 20071)  # 所有要素 14
gmsh.model.geo.addCurveLoop([-10097,10120,10121,10122], 20072)
gmsh.model.geo.addPlaneSurface([20072], 20072)  # 所有要素 15
gmsh.model.geo.addCurveLoop([10123,10124,10125,-10100], 20073)
gmsh.model.geo.addPlaneSurface([20073], 20073)  # 所有要素 15
gmsh.model.geo.addCurveLoop([-10122,10126,-10123,-10102], 20074)
gmsh.model.geo.addPlaneSurface([20074], 20074)  # 所有要素 15
gmsh.model.geo.addCurveLoop([-10121,10127,-10124,-10126], 20075)
gmsh.model.geo.addPlaneSurface([20075], 20075)  # 所有要素 15
gmsh.model.geo.addCurveLoop([-10120,10103,-10125,-10127], 20076)
gmsh.model.geo.addPlaneSurface([20076], 20076)  # 所有要素 15
gmsh.model.geo.addCurveLoop([10115,10128,10122,10129], 20077)
gmsh.model.geo.addPlaneSurface([20077], 20077)  # 所有要素 16
gmsh.model.geo.addCurveLoop([10116,10130,10121,-10128], 20078)
gmsh.model.geo.addPlaneSurface([20078], 20078)  # 所有要素 16
gmsh.model.geo.addCurveLoop([10117,10131,10120,-10130], 20079)
gmsh.model.geo.addPlaneSurface([20079], 20079)  # 所有要素 16
gmsh.model.geo.addCurveLoop([-10092,-10129,-10097,-10131], 20080)
gmsh.model.geo.addPlaneSurface([20080], 20080)  # 所有要素 16
gmsh.model.geo.addCurveLoop([-10105,10132,10133,10134], 20081)
gmsh.model.geo.addPlaneSurface([20081], 20081)  # 所有要素 17
gmsh.model.geo.addCurveLoop([10135,10136,10137,-10108], 20082)
gmsh.model.geo.addPlaneSurface([20082], 20082)  # 所有要素 17
gmsh.model.geo.addCurveLoop([-10134,10138,-10135,-10110], 20083)
gmsh.model.geo.addPlaneSurface([20083], 20083)  # 所有要素 17
gmsh.model.geo.addCurveLoop([-10133,10139,-10136,-10138], 20084)
gmsh.model.geo.addPlaneSurface([20084], 20084)  # 所有要素 17
gmsh.model.geo.addCurveLoop([-10132,10111,-10137,-10139], 20085)
gmsh.model.geo.addPlaneSurface([20085], 20085)  # 所有要素 17
gmsh.model.geo.addCurveLoop([10140,10141,10142,10143], 20086)
gmsh.model.geo.addPlaneSurface([20086], 20086)  # 所有要素 18
gmsh.model.geo.addCurveLoop([10144,10145,10146,10147], 20087)
gmsh.model.geo.addPlaneSurface([20087], 20087)  # 所有要素 18
gmsh.model.geo.addCurveLoop([-10143,10148,-10144,10149], 20088)
gmsh.model.geo.addPlaneSurface([20088], 20088)  # 所有要素 18
gmsh.model.geo.addCurveLoop([-10142,10150,-10145,-10148], 20089)
gmsh.model.geo.addPlaneSurface([20089], 20089)  # 所有要素 18
gmsh.model.geo.addCurveLoop([-10141,10151,-10146,-10150], 20090)
gmsh.model.geo.addPlaneSurface([20090], 20090)  # 所有要素 18
gmsh.model.geo.addCurveLoop([-10140,-10149,-10147,-10151], 20091)
gmsh.model.geo.addPlaneSurface([20091], 20091)  # 所有要素 18
gmsh.model.geo.addCurveLoop([-10142,10152,10153,10154], 20092)
gmsh.model.geo.addPlaneSurface([20092], 20092)  # 所有要素 19
gmsh.model.geo.addCurveLoop([10155,10156,10157,-10145], 20093)
gmsh.model.geo.addPlaneSurface([20093], 20093)  # 所有要素 19
gmsh.model.geo.addCurveLoop([-10154,10158,-10155,-10148], 20094)
gmsh.model.geo.addPlaneSurface([20094], 20094)  # 所有要素 19
gmsh.model.geo.addCurveLoop([-10153,10159,-10156,-10158], 20095)
gmsh.model.geo.addPlaneSurface([20095], 20095)  # 所有要素 19
gmsh.model.geo.addCurveLoop([-10152,10150,-10157,-10159], 20096)
gmsh.model.geo.addPlaneSurface([20096], 20096)  # 所有要素 19
gmsh.model.geo.addCurveLoop([-10153,10160,10161,10162], 20097)
gmsh.model.geo.addPlaneSurface([20097], 20097)  # 所有要素 20
gmsh.model.geo.addCurveLoop([10163,10164,10165,-10156], 20098)
gmsh.model.geo.addPlaneSurface([20098], 20098)  # 所有要素 20
gmsh.model.geo.addCurveLoop([-10162,10166,-10163,-10158], 20099)
gmsh.model.geo.addPlaneSurface([20099], 20099)  # 所有要素 20
gmsh.model.geo.addCurveLoop([-10161,10167,-10164,-10166], 20100)
gmsh.model.geo.addPlaneSurface([20100], 20100)  # 所有要素 20
gmsh.model.geo.addCurveLoop([-10160,10159,-10165,-10167], 20101)
gmsh.model.geo.addPlaneSurface([20101], 20101)  # 所有要素 20
gmsh.model.geo.addCurveLoop([10168,10169,10170,10171], 20102)
gmsh.model.geo.addPlaneSurface([20102], 20102)  # 所有要素 21
gmsh.model.geo.addCurveLoop([10172,10173,10174,10175], 20103)
gmsh.model.geo.addPlaneSurface([20103], 20103)  # 所有要素 21
gmsh.model.geo.addCurveLoop([-10171,10176,-10172,10177], 20104)
gmsh.model.geo.addPlaneSurface([20104], 20104)  # 所有要素 21
gmsh.model.geo.addCurveLoop([-10170,10178,-10173,-10176], 20105)
gmsh.model.geo.addPlaneSurface([20105], 20105)  # 所有要素 21
gmsh.model.geo.addCurveLoop([-10169,10179,-10174,-10178], 20106)
gmsh.model.geo.addPlaneSurface([20106], 20106)  # 所有要素 21
gmsh.model.geo.addCurveLoop([-10168,-10177,-10175,-10179], 20107)
gmsh.model.geo.addPlaneSurface([20107], 20107)  # 所有要素 21
gmsh.model.geo.addCurveLoop([10180,10181,10182,10183], 20108)
gmsh.model.geo.addPlaneSurface([20108], 20108)  # 所有要素 22
gmsh.model.geo.addCurveLoop([10172,10184,-10180,10185], 20109)
gmsh.model.geo.addPlaneSurface([20109], 20109)  # 所有要素 22
gmsh.model.geo.addCurveLoop([10173,10186,-10181,-10184], 20110)
gmsh.model.geo.addPlaneSurface([20110], 20110)  # 所有要素 22
gmsh.model.geo.addCurveLoop([10174,10187,-10182,-10186], 20111)
gmsh.model.geo.addPlaneSurface([20111], 20111)  # 所有要素 22
gmsh.model.geo.addCurveLoop([10175,-10185,-10183,-10187], 20112)
gmsh.model.geo.addPlaneSurface([20112], 20112)  # 所有要素 22

gmsh.model.geo.addSurfaceLoop([20000,20001,20002,20003,20004,20005], 30001)
gmsh.model.geo.addVolume([30001], 1)
gmsh.model.geo.addSurfaceLoop([20006,20007,20008,20009,20010,20011], 30002)
gmsh.model.geo.addVolume([30002], 2)
gmsh.model.geo.addSurfaceLoop([20001,20006,20012,20013,20014,20015], 30003)
gmsh.model.geo.addVolume([30003], 3)
gmsh.model.geo.addSurfaceLoop([20016,20017,20018,20019,20020,20021], 30004)
gmsh.model.geo.addVolume([30004], 4)
gmsh.model.geo.addSurfaceLoop([20022,20023,20024,20025,20026,20003], 30005)
gmsh.model.geo.addVolume([30005], 5)
gmsh.model.geo.addSurfaceLoop([20027,20028,20029,20030,20031,20009], 30006)
gmsh.model.geo.addVolume([30006], 6)
gmsh.model.geo.addSurfaceLoop([20032,20033,20034,20035,20036,20019], 30007)
gmsh.model.geo.addVolume([30007], 7)
gmsh.model.geo.addSurfaceLoop([20037,20038,20039,20040,20041,20025], 30008)
gmsh.model.geo.addVolume([30008], 8)
gmsh.model.geo.addSurfaceLoop([20042,20043,20044,20045,20046,20030], 30009)
gmsh.model.geo.addVolume([30009], 9)
gmsh.model.geo.addSurfaceLoop([20047,20048,20049,20050,20051,20035], 30010)
gmsh.model.geo.addVolume([30010], 10)
gmsh.model.geo.addSurfaceLoop([20052,20053,20054,20055,20056,20040], 30011)
gmsh.model.geo.addVolume([30011], 11)
gmsh.model.geo.addSurfaceLoop([20057,20058,20059,20060,20061,20045], 30012)
gmsh.model.geo.addVolume([30012], 12)
gmsh.model.geo.addSurfaceLoop([20062,20063,20064,20065,20066,20050], 30013)
gmsh.model.geo.addVolume([30013], 13)
gmsh.model.geo.addSurfaceLoop([20067,20068,20069,20070,20071,20055], 30014)
gmsh.model.geo.addVolume([30014], 14)
gmsh.model.geo.addSurfaceLoop([20072,20073,20074,20075,20076,20060], 30015)
gmsh.model.geo.addVolume([30015], 15)
gmsh.model.geo.addSurfaceLoop([20068,20072,20077,20078,20079,20080], 30016)
gmsh.model.geo.addVolume([30016], 16)
gmsh.model.geo.addSurfaceLoop([20081,20082,20083,20084,20085,20065], 30017)
gmsh.model.geo.addVolume([30017], 17)
gmsh.model.geo.addSurfaceLoop([20086,20087,20088,20089,20090,20091], 30018)
gmsh.model.geo.addVolume([30018], 18)
gmsh.model.geo.addSurfaceLoop([20092,20093,20094,20095,20096,20089], 30019)
gmsh.model.geo.addVolume([30019], 19)
gmsh.model.geo.addSurfaceLoop([20097,20098,20099,20100,20101,20095], 30020)
gmsh.model.geo.addVolume([30020], 20)
gmsh.model.geo.addSurfaceLoop([20102,20103,20104,20105,20106,20107], 30021)
gmsh.model.geo.addVolume([30021], 21)
gmsh.model.geo.addSurfaceLoop([20103,20108,20109,20110,20111,20112], 30022)
gmsh.model.geo.addVolume([30022], 22)

gmsh.model.geo.synchronize()

gmsh.model.mesh.setTransfiniteCurve(10000, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10001, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10002, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10003, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10004, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10005, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10006, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10007, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10008, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10009, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10010, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10011, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10012, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10013, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10014, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10015, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10016, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10017, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10018, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10019, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10020, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10021, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10022, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10023, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10024, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10025, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10026, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10027, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10028, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10029, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10030, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10031, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10032, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10033, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10034, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10035, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10036, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10037, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10038, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10039, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10040, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10041, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10042, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10043, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10044, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10045, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10046, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10047, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10048, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10049, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10050, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10051, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10052, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10053, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10054, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10055, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10056, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10057, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10058, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10059, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10060, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10061, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10062, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10063, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10064, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10065, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10066, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10067, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10068, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10069, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10070, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10071, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10072, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10073, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10074, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10075, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10076, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10077, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10078, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10079, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10080, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10081, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10082, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10083, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10084, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10085, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10086, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10087, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10088, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10089, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10090, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10091, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10092, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10093, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10094, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10095, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10096, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10097, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10098, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10099, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10100, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10101, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10102, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10103, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10104, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10105, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10106, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10107, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10108, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10109, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10110, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10111, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10112, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10113, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10114, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10115, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10116, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10117, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10118, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10119, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10120, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10121, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10122, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10123, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10124, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10125, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10126, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10127, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10128, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10129, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10130, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10131, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10132, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10133, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10134, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10135, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10136, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10137, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10138, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10139, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10140, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10141, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10142, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10143, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10144, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10145, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10146, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10147, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10148, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10149, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10150, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10151, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10152, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10153, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10154, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10155, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10156, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10157, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10158, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10159, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10160, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10161, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10162, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10163, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10164, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10165, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10166, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10167, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10168, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10169, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10170, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10171, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10172, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10173, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10174, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10175, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10176, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10177, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10178, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10179, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10180, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10181, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10182, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10183, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10184, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10185, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10186, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteCurve(10187, TRANSFINITE_CURVE_DIVISIONS)
gmsh.model.mesh.setTransfiniteSurface(20000)
gmsh.model.mesh.setRecombine(2, 20000)
gmsh.model.mesh.setTransfiniteSurface(20001)
gmsh.model.mesh.setRecombine(2, 20001)
gmsh.model.mesh.setTransfiniteSurface(20002)
gmsh.model.mesh.setRecombine(2, 20002)
gmsh.model.mesh.setTransfiniteSurface(20003)
gmsh.model.mesh.setRecombine(2, 20003)
gmsh.model.mesh.setTransfiniteSurface(20004)
gmsh.model.mesh.setRecombine(2, 20004)
gmsh.model.mesh.setTransfiniteSurface(20005)
gmsh.model.mesh.setRecombine(2, 20005)
gmsh.model.mesh.setTransfiniteSurface(20006)
gmsh.model.mesh.setRecombine(2, 20006)
gmsh.model.mesh.setTransfiniteSurface(20007)
gmsh.model.mesh.setRecombine(2, 20007)
gmsh.model.mesh.setTransfiniteSurface(20008)
gmsh.model.mesh.setRecombine(2, 20008)
gmsh.model.mesh.setTransfiniteSurface(20009)
gmsh.model.mesh.setRecombine(2, 20009)
gmsh.model.mesh.setTransfiniteSurface(20010)
gmsh.model.mesh.setRecombine(2, 20010)
gmsh.model.mesh.setTransfiniteSurface(20011)
gmsh.model.mesh.setRecombine(2, 20011)
gmsh.model.mesh.setTransfiniteSurface(20012)
gmsh.model.mesh.setRecombine(2, 20012)
gmsh.model.mesh.setTransfiniteSurface(20013)
gmsh.model.mesh.setRecombine(2, 20013)
gmsh.model.mesh.setTransfiniteSurface(20014)
gmsh.model.mesh.setRecombine(2, 20014)
gmsh.model.mesh.setTransfiniteSurface(20015)
gmsh.model.mesh.setRecombine(2, 20015)
gmsh.model.mesh.setTransfiniteSurface(20016)
gmsh.model.mesh.setRecombine(2, 20016)
gmsh.model.mesh.setTransfiniteSurface(20017)
gmsh.model.mesh.setRecombine(2, 20017)
gmsh.model.mesh.setTransfiniteSurface(20018)
gmsh.model.mesh.setRecombine(2, 20018)
gmsh.model.mesh.setTransfiniteSurface(20019)
gmsh.model.mesh.setRecombine(2, 20019)
gmsh.model.mesh.setTransfiniteSurface(20020)
gmsh.model.mesh.setRecombine(2, 20020)
gmsh.model.mesh.setTransfiniteSurface(20021)
gmsh.model.mesh.setRecombine(2, 20021)
gmsh.model.mesh.setTransfiniteSurface(20022)
gmsh.model.mesh.setRecombine(2, 20022)
gmsh.model.mesh.setTransfiniteSurface(20023)
gmsh.model.mesh.setRecombine(2, 20023)
gmsh.model.mesh.setTransfiniteSurface(20024)
gmsh.model.mesh.setRecombine(2, 20024)
gmsh.model.mesh.setTransfiniteSurface(20025)
gmsh.model.mesh.setRecombine(2, 20025)
gmsh.model.mesh.setTransfiniteSurface(20026)
gmsh.model.mesh.setRecombine(2, 20026)
gmsh.model.mesh.setTransfiniteSurface(20027)
gmsh.model.mesh.setRecombine(2, 20027)
gmsh.model.mesh.setTransfiniteSurface(20028)
gmsh.model.mesh.setRecombine(2, 20028)
gmsh.model.mesh.setTransfiniteSurface(20029)
gmsh.model.mesh.setRecombine(2, 20029)
gmsh.model.mesh.setTransfiniteSurface(20030)
gmsh.model.mesh.setRecombine(2, 20030)
gmsh.model.mesh.setTransfiniteSurface(20031)
gmsh.model.mesh.setRecombine(2, 20031)
gmsh.model.mesh.setTransfiniteSurface(20032)
gmsh.model.mesh.setRecombine(2, 20032)
gmsh.model.mesh.setTransfiniteSurface(20033)
gmsh.model.mesh.setRecombine(2, 20033)
gmsh.model.mesh.setTransfiniteSurface(20034)
gmsh.model.mesh.setRecombine(2, 20034)
gmsh.model.mesh.setTransfiniteSurface(20035)
gmsh.model.mesh.setRecombine(2, 20035)
gmsh.model.mesh.setTransfiniteSurface(20036)
gmsh.model.mesh.setRecombine(2, 20036)
gmsh.model.mesh.setTransfiniteSurface(20037)
gmsh.model.mesh.setRecombine(2, 20037)
gmsh.model.mesh.setTransfiniteSurface(20038)
gmsh.model.mesh.setRecombine(2, 20038)
gmsh.model.mesh.setTransfiniteSurface(20039)
gmsh.model.mesh.setRecombine(2, 20039)
gmsh.model.mesh.setTransfiniteSurface(20040)
gmsh.model.mesh.setRecombine(2, 20040)
gmsh.model.mesh.setTransfiniteSurface(20041)
gmsh.model.mesh.setRecombine(2, 20041)
gmsh.model.mesh.setTransfiniteSurface(20042)
gmsh.model.mesh.setRecombine(2, 20042)
gmsh.model.mesh.setTransfiniteSurface(20043)
gmsh.model.mesh.setRecombine(2, 20043)
gmsh.model.mesh.setTransfiniteSurface(20044)
gmsh.model.mesh.setRecombine(2, 20044)
gmsh.model.mesh.setTransfiniteSurface(20045)
gmsh.model.mesh.setRecombine(2, 20045)
gmsh.model.mesh.setTransfiniteSurface(20046)
gmsh.model.mesh.setRecombine(2, 20046)
gmsh.model.mesh.setTransfiniteSurface(20047)
gmsh.model.mesh.setRecombine(2, 20047)
gmsh.model.mesh.setTransfiniteSurface(20048)
gmsh.model.mesh.setRecombine(2, 20048)
gmsh.model.mesh.setTransfiniteSurface(20049)
gmsh.model.mesh.setRecombine(2, 20049)
gmsh.model.mesh.setTransfiniteSurface(20050)
gmsh.model.mesh.setRecombine(2, 20050)
gmsh.model.mesh.setTransfiniteSurface(20051)
gmsh.model.mesh.setRecombine(2, 20051)
gmsh.model.mesh.setTransfiniteSurface(20052)
gmsh.model.mesh.setRecombine(2, 20052)
gmsh.model.mesh.setTransfiniteSurface(20053)
gmsh.model.mesh.setRecombine(2, 20053)
gmsh.model.mesh.setTransfiniteSurface(20054)
gmsh.model.mesh.setRecombine(2, 20054)
gmsh.model.mesh.setTransfiniteSurface(20055)
gmsh.model.mesh.setRecombine(2, 20055)
gmsh.model.mesh.setTransfiniteSurface(20056)
gmsh.model.mesh.setRecombine(2, 20056)
gmsh.model.mesh.setTransfiniteSurface(20057)
gmsh.model.mesh.setRecombine(2, 20057)
gmsh.model.mesh.setTransfiniteSurface(20058)
gmsh.model.mesh.setRecombine(2, 20058)
gmsh.model.mesh.setTransfiniteSurface(20059)
gmsh.model.mesh.setRecombine(2, 20059)
gmsh.model.mesh.setTransfiniteSurface(20060)
gmsh.model.mesh.setRecombine(2, 20060)
gmsh.model.mesh.setTransfiniteSurface(20061)
gmsh.model.mesh.setRecombine(2, 20061)
gmsh.model.mesh.setTransfiniteSurface(20062)
gmsh.model.mesh.setRecombine(2, 20062)
gmsh.model.mesh.setTransfiniteSurface(20063)
gmsh.model.mesh.setRecombine(2, 20063)
gmsh.model.mesh.setTransfiniteSurface(20064)
gmsh.model.mesh.setRecombine(2, 20064)
gmsh.model.mesh.setTransfiniteSurface(20065)
gmsh.model.mesh.setRecombine(2, 20065)
gmsh.model.mesh.setTransfiniteSurface(20066)
gmsh.model.mesh.setRecombine(2, 20066)
gmsh.model.mesh.setTransfiniteSurface(20067)
gmsh.model.mesh.setRecombine(2, 20067)
gmsh.model.mesh.setTransfiniteSurface(20068)
gmsh.model.mesh.setRecombine(2, 20068)
gmsh.model.mesh.setTransfiniteSurface(20069)
gmsh.model.mesh.setRecombine(2, 20069)
gmsh.model.mesh.setTransfiniteSurface(20070)
gmsh.model.mesh.setRecombine(2, 20070)
gmsh.model.mesh.setTransfiniteSurface(20071)
gmsh.model.mesh.setRecombine(2, 20071)
gmsh.model.mesh.setTransfiniteSurface(20072)
gmsh.model.mesh.setRecombine(2, 20072)
gmsh.model.mesh.setTransfiniteSurface(20073)
gmsh.model.mesh.setRecombine(2, 20073)
gmsh.model.mesh.setTransfiniteSurface(20074)
gmsh.model.mesh.setRecombine(2, 20074)
gmsh.model.mesh.setTransfiniteSurface(20075)
gmsh.model.mesh.setRecombine(2, 20075)
gmsh.model.mesh.setTransfiniteSurface(20076)
gmsh.model.mesh.setRecombine(2, 20076)
gmsh.model.mesh.setTransfiniteSurface(20077)
gmsh.model.mesh.setRecombine(2, 20077)
gmsh.model.mesh.setTransfiniteSurface(20078)
gmsh.model.mesh.setRecombine(2, 20078)
gmsh.model.mesh.setTransfiniteSurface(20079)
gmsh.model.mesh.setRecombine(2, 20079)
gmsh.model.mesh.setTransfiniteSurface(20080)
gmsh.model.mesh.setRecombine(2, 20080)
gmsh.model.mesh.setTransfiniteSurface(20081)
gmsh.model.mesh.setRecombine(2, 20081)
gmsh.model.mesh.setTransfiniteSurface(20082)
gmsh.model.mesh.setRecombine(2, 20082)
gmsh.model.mesh.setTransfiniteSurface(20083)
gmsh.model.mesh.setRecombine(2, 20083)
gmsh.model.mesh.setTransfiniteSurface(20084)
gmsh.model.mesh.setRecombine(2, 20084)
gmsh.model.mesh.setTransfiniteSurface(20085)
gmsh.model.mesh.setRecombine(2, 20085)
gmsh.model.mesh.setTransfiniteSurface(20086)
gmsh.model.mesh.setRecombine(2, 20086)
gmsh.model.mesh.setTransfiniteSurface(20087)
gmsh.model.mesh.setRecombine(2, 20087)
gmsh.model.mesh.setTransfiniteSurface(20088)
gmsh.model.mesh.setRecombine(2, 20088)
gmsh.model.mesh.setTransfiniteSurface(20089)
gmsh.model.mesh.setRecombine(2, 20089)
gmsh.model.mesh.setTransfiniteSurface(20090)
gmsh.model.mesh.setRecombine(2, 20090)
gmsh.model.mesh.setTransfiniteSurface(20091)
gmsh.model.mesh.setRecombine(2, 20091)
gmsh.model.mesh.setTransfiniteSurface(20092)
gmsh.model.mesh.setRecombine(2, 20092)
gmsh.model.mesh.setTransfiniteSurface(20093)
gmsh.model.mesh.setRecombine(2, 20093)
gmsh.model.mesh.setTransfiniteSurface(20094)
gmsh.model.mesh.setRecombine(2, 20094)
gmsh.model.mesh.setTransfiniteSurface(20095)
gmsh.model.mesh.setRecombine(2, 20095)
gmsh.model.mesh.setTransfiniteSurface(20096)
gmsh.model.mesh.setRecombine(2, 20096)
gmsh.model.mesh.setTransfiniteSurface(20097)
gmsh.model.mesh.setRecombine(2, 20097)
gmsh.model.mesh.setTransfiniteSurface(20098)
gmsh.model.mesh.setRecombine(2, 20098)
gmsh.model.mesh.setTransfiniteSurface(20099)
gmsh.model.mesh.setRecombine(2, 20099)
gmsh.model.mesh.setTransfiniteSurface(20100)
gmsh.model.mesh.setRecombine(2, 20100)
gmsh.model.mesh.setTransfiniteSurface(20101)
gmsh.model.mesh.setRecombine(2, 20101)
gmsh.model.mesh.setTransfiniteSurface(20102)
gmsh.model.mesh.setRecombine(2, 20102)
gmsh.model.mesh.setTransfiniteSurface(20103)
gmsh.model.mesh.setRecombine(2, 20103)
gmsh.model.mesh.setTransfiniteSurface(20104)
gmsh.model.mesh.setRecombine(2, 20104)
gmsh.model.mesh.setTransfiniteSurface(20105)
gmsh.model.mesh.setRecombine(2, 20105)
gmsh.model.mesh.setTransfiniteSurface(20106)
gmsh.model.mesh.setRecombine(2, 20106)
gmsh.model.mesh.setTransfiniteSurface(20107)
gmsh.model.mesh.setRecombine(2, 20107)
gmsh.model.mesh.setTransfiniteSurface(20108)
gmsh.model.mesh.setRecombine(2, 20108)
gmsh.model.mesh.setTransfiniteSurface(20109)
gmsh.model.mesh.setRecombine(2, 20109)
gmsh.model.mesh.setTransfiniteSurface(20110)
gmsh.model.mesh.setRecombine(2, 20110)
gmsh.model.mesh.setTransfiniteSurface(20111)
gmsh.model.mesh.setRecombine(2, 20111)
gmsh.model.mesh.setTransfiniteSurface(20112)
gmsh.model.mesh.setRecombine(2, 20112)
gmsh.model.mesh.setTransfiniteVolume(1, [1,2,3,4,5,6,7,8])
gmsh.model.mesh.setRecombine(3, 1)
gmsh.model.mesh.setTransfiniteVolume(2, [9,10,11,12,13,14,15,16])
gmsh.model.mesh.setRecombine(3, 2)
gmsh.model.mesh.setTransfiniteVolume(3, [5,6,7,8,9,10,11,12])
gmsh.model.mesh.setRecombine(3, 3)
gmsh.model.mesh.setTransfiniteVolume(4, [17,18,19,20,21,22,23,24])
gmsh.model.mesh.setRecombine(3, 4)
gmsh.model.mesh.setTransfiniteVolume(5, [2,25,26,3,6,27,28,7])
gmsh.model.mesh.setRecombine(3, 5)
gmsh.model.mesh.setTransfiniteVolume(6, [10,29,30,11,14,31,32,15])
gmsh.model.mesh.setRecombine(3, 6)
gmsh.model.mesh.setTransfiniteVolume(7, [18,33,34,19,22,35,36,23])
gmsh.model.mesh.setRecombine(3, 7)
gmsh.model.mesh.setTransfiniteVolume(8, [25,37,38,26,27,39,40,28])
gmsh.model.mesh.setRecombine(3, 8)
gmsh.model.mesh.setTransfiniteVolume(9, [29,41,42,30,31,43,44,32])
gmsh.model.mesh.setRecombine(3, 9)
gmsh.model.mesh.setTransfiniteVolume(10, [33,45,46,34,35,47,48,36])
gmsh.model.mesh.setRecombine(3, 10)
gmsh.model.mesh.setTransfiniteVolume(11, [37,49,50,38,39,51,52,40])
gmsh.model.mesh.setRecombine(3, 11)
gmsh.model.mesh.setTransfiniteVolume(12, [41,53,54,42,43,55,56,44])
gmsh.model.mesh.setRecombine(3, 12)
gmsh.model.mesh.setTransfiniteVolume(13, [45,57,58,46,47,59,60,48])
gmsh.model.mesh.setRecombine(3, 13)
gmsh.model.mesh.setTransfiniteVolume(14, [49,61,62,50,51,63,64,52])
gmsh.model.mesh.setRecombine(3, 14)
gmsh.model.mesh.setTransfiniteVolume(15, [53,65,66,54,55,67,68,56])
gmsh.model.mesh.setRecombine(3, 15)
gmsh.model.mesh.setTransfiniteVolume(16, [51,63,64,52,53,65,66,54])
gmsh.model.mesh.setRecombine(3, 16)
gmsh.model.mesh.setTransfiniteVolume(17, [57,69,70,58,59,71,72,60])
gmsh.model.mesh.setRecombine(3, 17)
gmsh.model.mesh.setTransfiniteVolume(18, [73,74,75,76,77,78,79,80])
gmsh.model.mesh.setRecombine(3, 18)
gmsh.model.mesh.setTransfiniteVolume(19, [74,81,82,75,78,83,84,79])
gmsh.model.mesh.setRecombine(3, 19)
gmsh.model.mesh.setTransfiniteVolume(20, [81,85,86,82,83,87,88,84])
gmsh.model.mesh.setRecombine(3, 20)
gmsh.model.mesh.setTransfiniteVolume(21, [89,90,91,92,93,94,95,96])
gmsh.model.mesh.setRecombine(3, 21)
gmsh.model.mesh.setTransfiniteVolume(22, [93,94,95,96,97,98,99,100])
gmsh.model.mesh.setRecombine(3, 22)

for name, tags in PHYSICAL_VOLUMES.items():
    group = gmsh.model.addPhysicalGroup(3, require_existing_entity_tags(3, name, tags), PHYSICAL_GROUP_IDS[3][name])
    gmsh.model.setPhysicalName(3, group, name)
for name, tags in PHYSICAL_SURFACES.items():
    group = gmsh.model.addPhysicalGroup(2, require_existing_entity_tags(2, name, tags), PHYSICAL_GROUP_IDS[2][name])
    gmsh.model.setPhysicalName(2, group, name)

gmsh.model.mesh.generate(3)
gmsh.write(str(OUT_MSH))
if "--gui" in sys.argv:
    gmsh.fltk.run()
gmsh.finalize()
print(OUT_MSH)

