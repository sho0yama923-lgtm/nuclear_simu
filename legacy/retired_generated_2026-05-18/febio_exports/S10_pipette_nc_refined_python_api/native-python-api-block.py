# Generated Gmsh Python API block mesh for the FEBio native mesh.
# Edit coordinate variables / PHYSICAL_SURFACES here; FEBio names are assigned from the registry below.
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

OUT_MSH = "/home/xiogo/projects/nuclear_simu/febio_exports/S10_pipette_nc_refined_python_api/native-python-api-block.msh"
lc = 1

# Coordinate planes used by the rectangular block layout.
X_n26 = -26
X_n14 = -14
X_14 = 14
X_26 = 26
X_27 = 27
Y_n0p5 = -0.5
Y_n0p2 = -0.2
Y_0p2 = 0.2
Y_0p5 = 0.5
Z_n2p72 = -2.72
Z_0 = 0
Z_8 = 8
Z_10p5 = 10.5
Z_13p75 = 13.75
Z_20p25 = 20.25
Z_23p5 = 23.5
Z_26 = 26
Z_34 = 34

# High-value editing handles.
# To make the pipette thinner in the current x-z view, move pipetteZBottom / pipetteZTop toward the patch band.
# To shorten or lengthen the rigid pipette barrel, edit pipetteOuterX.
pipetteMouthX = X_14
pipetteOuterX = X_27
pipetteYMin = Y_n0p2
pipetteYMax = Y_0p2
pipetteZBottom = Z_10p5
pipettePatchZBottom = Z_13p75
pipettePatchZTop = Z_20p25
pipetteZTop = Z_23p5

PHYSICAL_VOLUMES = {
    "cytoplasm": [1,5,6,7,10,11,12,13,16,17],
    "nucleus": [2,14,15],
    "pipette": [3,18,19],
    "dish": [4,8,9],
}
PHYSICAL_SURFACES = {
    "cell_dish_surface": [20000,20024,20030],
    "cell_dish_left_surface": [20000],
    "nucleus_interface_surface": [20006,20035],
    "nucleus_interface_bottom_surface": [20006],
    "nucleus_interface_right_surface": [20009,20074,20078],
    "pipette_suction_surface": [20009,20074,20078],
    "nucleus_interface_left_surface": [20011,20076,20080],
    "pipette_contact_surface": [20017,20094,20099],
    "pipette_mouth_surface": [20017,20094,20099],
    "dish_contact_surface": [20019,20042,20047],
    "dish_contact_left_surface": [20019],
    "cell_dish_right_surface": [20024],
    "cell_dish_center_surface": [20030],
    "nucleus_interface_top_surface": [20035],
    "dish_contact_center_surface": [20042],
    "dish_contact_right_surface": [20047],
    "cytoplasm_interface_surface": [20053],
    "cytoplasm_interface_left_surface": [20053],
    "cytoplasm_interface_right_surface": [20065,20085,20089],
    "pipette_suction_patch": [20074],
    "pipette_mouth_patch": [20094],
}
PHYSICAL_GROUP_IDS = {
    3: {
        "cytoplasm": 1,
        "nucleus": 2,
        "pipette": 3,
        "dish": 4,
    },
    2: {
        "cell_dish_surface": 15,
        "cell_dish_left_surface": 17,
        "nucleus_interface_surface": 5,
        "nucleus_interface_bottom_surface": 9,
        "nucleus_interface_right_surface": 7,
        "pipette_suction_surface": 20,
        "nucleus_interface_left_surface": 6,
        "pipette_contact_surface": 21,
        "pipette_mouth_surface": 26,
        "dish_contact_surface": 16,
        "dish_contact_left_surface": 22,
        "cell_dish_right_surface": 19,
        "cell_dish_center_surface": 18,
        "nucleus_interface_top_surface": 8,
        "dish_contact_center_surface": 23,
        "dish_contact_right_surface": 24,
        "cytoplasm_interface_surface": 10,
        "cytoplasm_interface_left_surface": 11,
        "cytoplasm_interface_right_surface": 12,
        "pipette_suction_patch": 25,
        "pipette_mouth_patch": 27,
    },
}

gmsh.initialize(sys.argv)
gmsh.model.add("febio_native_parametric_block")
gmsh.option.setNumber("Mesh.MshFileVersion", 2.2)
gmsh.option.setNumber("Mesh.SaveAll", 0)
gmsh.option.setNumber("Mesh.RecombineAll", 1)

gmsh.model.geo.addPoint(X_n26, Y_n0p5, Z_0, lc, 1)
gmsh.model.geo.addPoint(X_n14, Y_n0p5, Z_0, lc, 2)
gmsh.model.geo.addPoint(X_n14, Y_0p5, Z_0, lc, 3)
gmsh.model.geo.addPoint(X_n26, Y_0p5, Z_0, lc, 4)
gmsh.model.geo.addPoint(X_n26, Y_n0p5, Z_34, lc, 5)
gmsh.model.geo.addPoint(X_n14, Y_n0p5, Z_34, lc, 6)
gmsh.model.geo.addPoint(X_n14, Y_0p5, Z_34, lc, 7)
gmsh.model.geo.addPoint(X_n26, Y_0p5, Z_34, lc, 8)
gmsh.model.geo.addPoint(pipetteMouthX, pipetteYMin, pipetteZBottom, lc, 17)
gmsh.model.geo.addPoint(pipetteOuterX, pipetteYMin, pipetteZBottom, lc, 18)
gmsh.model.geo.addPoint(pipetteOuterX, pipetteYMax, pipetteZBottom, lc, 19)
gmsh.model.geo.addPoint(pipetteMouthX, pipetteYMax, pipetteZBottom, lc, 20)
gmsh.model.geo.addPoint(pipetteMouthX, pipetteYMin, pipetteZTop, lc, 21)
gmsh.model.geo.addPoint(pipetteOuterX, pipetteYMin, pipetteZTop, lc, 22)
gmsh.model.geo.addPoint(pipetteOuterX, pipetteYMax, pipetteZTop, lc, 23)
gmsh.model.geo.addPoint(pipetteMouthX, pipetteYMax, pipetteZTop, lc, 24)
gmsh.model.geo.addPoint(X_n26, Y_n0p5, Z_n2p72, lc, 25)
gmsh.model.geo.addPoint(X_26, Y_n0p5, Z_n2p72, lc, 26)
gmsh.model.geo.addPoint(X_26, Y_0p5, Z_n2p72, lc, 27)
gmsh.model.geo.addPoint(X_n26, Y_0p5, Z_n2p72, lc, 28)
gmsh.model.geo.addPoint(X_n26, Y_n0p5, Z_0, lc, 29)
gmsh.model.geo.addPoint(X_26, Y_n0p5, Z_0, lc, 30)
gmsh.model.geo.addPoint(X_26, Y_0p5, Z_0, lc, 31)
gmsh.model.geo.addPoint(X_n26, Y_0p5, Z_0, lc, 32)
gmsh.model.geo.addPoint(pipetteMouthX, Y_n0p5, Z_0, lc, 33)
gmsh.model.geo.addPoint(X_26, Y_n0p5, Z_0, lc, 34)
gmsh.model.geo.addPoint(X_26, Y_0p5, Z_0, lc, 35)
gmsh.model.geo.addPoint(pipetteMouthX, Y_0p5, Z_0, lc, 36)
gmsh.model.geo.addPoint(pipetteMouthX, Y_n0p5, Z_34, lc, 37)
gmsh.model.geo.addPoint(X_26, Y_n0p5, Z_34, lc, 38)
gmsh.model.geo.addPoint(X_26, Y_0p5, Z_34, lc, 39)
gmsh.model.geo.addPoint(pipetteMouthX, Y_0p5, Z_34, lc, 40)
gmsh.model.geo.addPoint(X_n14, Y_n0p5, Z_0, lc, 41)
gmsh.model.geo.addPoint(pipetteMouthX, Y_n0p5, Z_0, lc, 42)
gmsh.model.geo.addPoint(pipetteMouthX, Y_0p5, Z_0, lc, 43)
gmsh.model.geo.addPoint(X_n14, Y_0p5, Z_0, lc, 44)
gmsh.model.geo.addPoint(X_n14, Y_n0p5, Z_8, lc, 45)
gmsh.model.geo.addPoint(pipetteMouthX, Y_n0p5, Z_8, lc, 46)
gmsh.model.geo.addPoint(pipetteMouthX, Y_0p5, Z_8, lc, 47)
gmsh.model.geo.addPoint(X_n14, Y_0p5, Z_8, lc, 48)
gmsh.model.geo.addPoint(X_n14, Y_n0p5, Z_26, lc, 49)
gmsh.model.geo.addPoint(pipetteMouthX, Y_n0p5, Z_26, lc, 50)
gmsh.model.geo.addPoint(pipetteMouthX, Y_0p5, Z_26, lc, 51)
gmsh.model.geo.addPoint(X_n14, Y_0p5, Z_26, lc, 52)
gmsh.model.geo.addPoint(X_n14, Y_n0p5, Z_34, lc, 53)
gmsh.model.geo.addPoint(pipetteMouthX, Y_n0p5, Z_34, lc, 54)
gmsh.model.geo.addPoint(pipetteMouthX, Y_0p5, Z_34, lc, 55)
gmsh.model.geo.addPoint(X_n14, Y_0p5, Z_34, lc, 56)
gmsh.model.geo.addPoint(X_n14, Y_n0p5, Z_n2p72, lc, 57)
gmsh.model.geo.addPoint(X_n14, Y_0p5, Z_n2p72, lc, 58)
gmsh.model.geo.addPoint(pipetteMouthX, Y_n0p5, Z_n2p72, lc, 59)
gmsh.model.geo.addPoint(pipetteMouthX, Y_0p5, Z_n2p72, lc, 60)
gmsh.model.geo.addPoint(X_n14, Y_n0p5, Z_0, lc, 61)
gmsh.model.geo.addPoint(X_n14, Y_0p5, Z_0, lc, 62)
gmsh.model.geo.addPoint(pipetteMouthX, Y_n0p5, Z_0, lc, 63)
gmsh.model.geo.addPoint(pipetteMouthX, Y_0p5, Z_0, lc, 64)
gmsh.model.geo.addPoint(X_n26, Y_n0p5, Z_8, lc, 65)
gmsh.model.geo.addPoint(X_n26, Y_0p5, Z_8, lc, 66)
gmsh.model.geo.addPoint(X_n26, Y_n0p5, Z_26, lc, 67)
gmsh.model.geo.addPoint(X_n26, Y_0p5, Z_26, lc, 68)
gmsh.model.geo.addPoint(X_26, Y_n0p5, Z_8, lc, 69)
gmsh.model.geo.addPoint(X_26, Y_0p5, Z_8, lc, 70)
gmsh.model.geo.addPoint(X_26, Y_n0p5, Z_26, lc, 71)
gmsh.model.geo.addPoint(X_26, Y_0p5, Z_26, lc, 72)
gmsh.model.geo.addPoint(X_n14, Y_n0p5, Z_8, lc, 73)
gmsh.model.geo.addPoint(pipetteMouthX, Y_n0p5, Z_8, lc, 74)
gmsh.model.geo.addPoint(pipetteMouthX, Y_0p5, Z_8, lc, 75)
gmsh.model.geo.addPoint(X_n14, Y_0p5, Z_8, lc, 76)
gmsh.model.geo.addPoint(X_n14, Y_n0p5, Z_26, lc, 77)
gmsh.model.geo.addPoint(pipetteMouthX, Y_n0p5, Z_26, lc, 78)
gmsh.model.geo.addPoint(pipetteMouthX, Y_0p5, Z_26, lc, 79)
gmsh.model.geo.addPoint(X_n14, Y_0p5, Z_26, lc, 80)
gmsh.model.geo.addPoint(X_n14, Y_n0p5, pipettePatchZBottom, lc, 81)
gmsh.model.geo.addPoint(pipetteMouthX, Y_n0p5, pipettePatchZBottom, lc, 82)
gmsh.model.geo.addPoint(pipetteMouthX, Y_0p5, pipettePatchZBottom, lc, 83)
gmsh.model.geo.addPoint(X_n14, Y_0p5, pipettePatchZBottom, lc, 84)
gmsh.model.geo.addPoint(X_n14, Y_n0p5, pipettePatchZTop, lc, 85)
gmsh.model.geo.addPoint(pipetteMouthX, Y_n0p5, pipettePatchZTop, lc, 86)
gmsh.model.geo.addPoint(pipetteMouthX, Y_0p5, pipettePatchZTop, lc, 87)
gmsh.model.geo.addPoint(X_n14, Y_0p5, pipettePatchZTop, lc, 88)
gmsh.model.geo.addPoint(pipetteMouthX, Y_n0p5, pipettePatchZBottom, lc, 89)
gmsh.model.geo.addPoint(pipetteMouthX, Y_0p5, pipettePatchZBottom, lc, 90)
gmsh.model.geo.addPoint(pipetteMouthX, Y_n0p5, pipettePatchZTop, lc, 91)
gmsh.model.geo.addPoint(pipetteMouthX, Y_0p5, pipettePatchZTop, lc, 92)
gmsh.model.geo.addPoint(X_26, Y_n0p5, pipettePatchZBottom, lc, 93)
gmsh.model.geo.addPoint(X_26, Y_0p5, pipettePatchZBottom, lc, 94)
gmsh.model.geo.addPoint(X_26, Y_n0p5, pipettePatchZTop, lc, 95)
gmsh.model.geo.addPoint(X_26, Y_0p5, pipettePatchZTop, lc, 96)
gmsh.model.geo.addPoint(pipetteMouthX, pipetteYMin, pipettePatchZBottom, lc, 97)
gmsh.model.geo.addPoint(pipetteOuterX, pipetteYMin, pipettePatchZBottom, lc, 98)
gmsh.model.geo.addPoint(pipetteOuterX, pipetteYMax, pipettePatchZBottom, lc, 99)
gmsh.model.geo.addPoint(pipetteMouthX, pipetteYMax, pipettePatchZBottom, lc, 100)
gmsh.model.geo.addPoint(pipetteMouthX, pipetteYMin, pipettePatchZTop, lc, 101)
gmsh.model.geo.addPoint(pipetteOuterX, pipetteYMin, pipettePatchZTop, lc, 102)
gmsh.model.geo.addPoint(pipetteOuterX, pipetteYMax, pipettePatchZTop, lc, 103)
gmsh.model.geo.addPoint(pipetteMouthX, pipetteYMax, pipettePatchZTop, lc, 104)

gmsh.model.geo.addLine(1, 4, 10000)
gmsh.model.geo.addLine(4, 3, 10001)
gmsh.model.geo.addLine(3, 2, 10002)
gmsh.model.geo.addLine(2, 1, 10003)
gmsh.model.geo.addLine(65, 73, 10004)
gmsh.model.geo.addLine(73, 76, 10005)
gmsh.model.geo.addLine(76, 66, 10006)
gmsh.model.geo.addLine(66, 65, 10007)
gmsh.model.geo.addLine(2, 73, 10008)
gmsh.model.geo.addLine(65, 1, 10009)
gmsh.model.geo.addLine(3, 76, 10010)
gmsh.model.geo.addLine(4, 66, 10011)
gmsh.model.geo.addLine(45, 48, 10012)
gmsh.model.geo.addLine(48, 47, 10013)
gmsh.model.geo.addLine(47, 46, 10014)
gmsh.model.geo.addLine(46, 45, 10015)
gmsh.model.geo.addLine(81, 82, 10016)
gmsh.model.geo.addLine(82, 83, 10017)
gmsh.model.geo.addLine(83, 84, 10018)
gmsh.model.geo.addLine(84, 81, 10019)
gmsh.model.geo.addLine(46, 82, 10020)
gmsh.model.geo.addLine(81, 45, 10021)
gmsh.model.geo.addLine(47, 83, 10022)
gmsh.model.geo.addLine(48, 84, 10023)
gmsh.model.geo.addLine(17, 20, 10024)
gmsh.model.geo.addLine(20, 19, 10025)
gmsh.model.geo.addLine(19, 18, 10026)
gmsh.model.geo.addLine(18, 17, 10027)
gmsh.model.geo.addLine(97, 98, 10028)
gmsh.model.geo.addLine(98, 99, 10029)
gmsh.model.geo.addLine(99, 100, 10030)
gmsh.model.geo.addLine(100, 97, 10031)
gmsh.model.geo.addLine(18, 98, 10032)
gmsh.model.geo.addLine(97, 17, 10033)
gmsh.model.geo.addLine(19, 99, 10034)
gmsh.model.geo.addLine(20, 100, 10035)
gmsh.model.geo.addLine(25, 28, 10036)
gmsh.model.geo.addLine(28, 58, 10037)
gmsh.model.geo.addLine(58, 57, 10038)
gmsh.model.geo.addLine(57, 25, 10039)
gmsh.model.geo.addLine(29, 61, 10040)
gmsh.model.geo.addLine(61, 62, 10041)
gmsh.model.geo.addLine(62, 32, 10042)
gmsh.model.geo.addLine(32, 29, 10043)
gmsh.model.geo.addLine(57, 61, 10044)
gmsh.model.geo.addLine(29, 25, 10045)
gmsh.model.geo.addLine(58, 62, 10046)
gmsh.model.geo.addLine(28, 32, 10047)
gmsh.model.geo.addLine(33, 36, 10048)
gmsh.model.geo.addLine(36, 35, 10049)
gmsh.model.geo.addLine(35, 34, 10050)
gmsh.model.geo.addLine(34, 33, 10051)
gmsh.model.geo.addLine(74, 69, 10052)
gmsh.model.geo.addLine(69, 70, 10053)
gmsh.model.geo.addLine(70, 75, 10054)
gmsh.model.geo.addLine(75, 74, 10055)
gmsh.model.geo.addLine(34, 69, 10056)
gmsh.model.geo.addLine(74, 33, 10057)
gmsh.model.geo.addLine(35, 70, 10058)
gmsh.model.geo.addLine(36, 75, 10059)
gmsh.model.geo.addLine(41, 44, 10060)
gmsh.model.geo.addLine(44, 43, 10061)
gmsh.model.geo.addLine(43, 42, 10062)
gmsh.model.geo.addLine(42, 41, 10063)
gmsh.model.geo.addLine(42, 46, 10064)
gmsh.model.geo.addLine(45, 41, 10065)
gmsh.model.geo.addLine(43, 47, 10066)
gmsh.model.geo.addLine(44, 48, 10067)
gmsh.model.geo.addLine(49, 52, 10068)
gmsh.model.geo.addLine(52, 51, 10069)
gmsh.model.geo.addLine(51, 50, 10070)
gmsh.model.geo.addLine(50, 49, 10071)
gmsh.model.geo.addLine(53, 54, 10072)
gmsh.model.geo.addLine(54, 55, 10073)
gmsh.model.geo.addLine(55, 56, 10074)
gmsh.model.geo.addLine(56, 53, 10075)
gmsh.model.geo.addLine(50, 54, 10076)
gmsh.model.geo.addLine(53, 49, 10077)
gmsh.model.geo.addLine(51, 55, 10078)
gmsh.model.geo.addLine(52, 56, 10079)
gmsh.model.geo.addLine(58, 60, 10080)
gmsh.model.geo.addLine(60, 59, 10081)
gmsh.model.geo.addLine(59, 57, 10082)
gmsh.model.geo.addLine(61, 63, 10083)
gmsh.model.geo.addLine(63, 64, 10084)
gmsh.model.geo.addLine(64, 62, 10085)
gmsh.model.geo.addLine(59, 63, 10086)
gmsh.model.geo.addLine(60, 64, 10087)
gmsh.model.geo.addLine(60, 27, 10088)
gmsh.model.geo.addLine(27, 26, 10089)
gmsh.model.geo.addLine(26, 59, 10090)
gmsh.model.geo.addLine(63, 30, 10091)
gmsh.model.geo.addLine(30, 31, 10092)
gmsh.model.geo.addLine(31, 64, 10093)
gmsh.model.geo.addLine(26, 30, 10094)
gmsh.model.geo.addLine(27, 31, 10095)
gmsh.model.geo.addLine(67, 77, 10096)
gmsh.model.geo.addLine(77, 80, 10097)
gmsh.model.geo.addLine(80, 68, 10098)
gmsh.model.geo.addLine(68, 67, 10099)
gmsh.model.geo.addLine(73, 77, 10100)
gmsh.model.geo.addLine(67, 65, 10101)
gmsh.model.geo.addLine(76, 80, 10102)
gmsh.model.geo.addLine(66, 68, 10103)
gmsh.model.geo.addLine(5, 6, 10104)
gmsh.model.geo.addLine(6, 7, 10105)
gmsh.model.geo.addLine(7, 8, 10106)
gmsh.model.geo.addLine(8, 5, 10107)
gmsh.model.geo.addLine(77, 6, 10108)
gmsh.model.geo.addLine(5, 67, 10109)
gmsh.model.geo.addLine(80, 7, 10110)
gmsh.model.geo.addLine(68, 8, 10111)
gmsh.model.geo.addLine(89, 93, 10112)
gmsh.model.geo.addLine(93, 94, 10113)
gmsh.model.geo.addLine(94, 90, 10114)
gmsh.model.geo.addLine(90, 89, 10115)
gmsh.model.geo.addLine(69, 93, 10116)
gmsh.model.geo.addLine(89, 74, 10117)
gmsh.model.geo.addLine(70, 94, 10118)
gmsh.model.geo.addLine(75, 90, 10119)
gmsh.model.geo.addLine(78, 79, 10120)
gmsh.model.geo.addLine(79, 72, 10121)
gmsh.model.geo.addLine(72, 71, 10122)
gmsh.model.geo.addLine(71, 78, 10123)
gmsh.model.geo.addLine(37, 38, 10124)
gmsh.model.geo.addLine(38, 39, 10125)
gmsh.model.geo.addLine(39, 40, 10126)
gmsh.model.geo.addLine(40, 37, 10127)
gmsh.model.geo.addLine(71, 38, 10128)
gmsh.model.geo.addLine(37, 78, 10129)
gmsh.model.geo.addLine(72, 39, 10130)
gmsh.model.geo.addLine(79, 40, 10131)
gmsh.model.geo.addLine(85, 86, 10132)
gmsh.model.geo.addLine(86, 87, 10133)
gmsh.model.geo.addLine(87, 88, 10134)
gmsh.model.geo.addLine(88, 85, 10135)
gmsh.model.geo.addLine(82, 86, 10136)
gmsh.model.geo.addLine(85, 81, 10137)
gmsh.model.geo.addLine(83, 87, 10138)
gmsh.model.geo.addLine(84, 88, 10139)
gmsh.model.geo.addLine(86, 50, 10140)
gmsh.model.geo.addLine(49, 85, 10141)
gmsh.model.geo.addLine(87, 51, 10142)
gmsh.model.geo.addLine(88, 52, 10143)
gmsh.model.geo.addLine(91, 95, 10144)
gmsh.model.geo.addLine(95, 96, 10145)
gmsh.model.geo.addLine(96, 92, 10146)
gmsh.model.geo.addLine(92, 91, 10147)
gmsh.model.geo.addLine(93, 95, 10148)
gmsh.model.geo.addLine(91, 89, 10149)
gmsh.model.geo.addLine(94, 96, 10150)
gmsh.model.geo.addLine(90, 92, 10151)
gmsh.model.geo.addLine(95, 71, 10152)
gmsh.model.geo.addLine(78, 91, 10153)
gmsh.model.geo.addLine(96, 72, 10154)
gmsh.model.geo.addLine(92, 79, 10155)
gmsh.model.geo.addLine(101, 102, 10156)
gmsh.model.geo.addLine(102, 103, 10157)
gmsh.model.geo.addLine(103, 104, 10158)
gmsh.model.geo.addLine(104, 101, 10159)
gmsh.model.geo.addLine(98, 102, 10160)
gmsh.model.geo.addLine(101, 97, 10161)
gmsh.model.geo.addLine(99, 103, 10162)
gmsh.model.geo.addLine(100, 104, 10163)
gmsh.model.geo.addLine(21, 22, 10164)
gmsh.model.geo.addLine(22, 23, 10165)
gmsh.model.geo.addLine(23, 24, 10166)
gmsh.model.geo.addLine(24, 21, 10167)
gmsh.model.geo.addLine(102, 22, 10168)
gmsh.model.geo.addLine(21, 101, 10169)
gmsh.model.geo.addLine(103, 23, 10170)
gmsh.model.geo.addLine(104, 24, 10171)

gmsh.model.geo.addCurveLoop([10000,10001,10002,10003], 20000)
gmsh.model.geo.addPlaneSurface([20000], 20000)  # owner element 1
gmsh.model.geo.addCurveLoop([10004,10005,10006,10007], 20001)
gmsh.model.geo.addPlaneSurface([20001], 20001)  # owner element 1
gmsh.model.geo.addCurveLoop([-10003,10008,-10004,10009], 20002)
gmsh.model.geo.addPlaneSurface([20002], 20002)  # owner element 1
gmsh.model.geo.addCurveLoop([-10002,10010,-10005,-10008], 20003)
gmsh.model.geo.addPlaneSurface([20003], 20003)  # owner element 1
gmsh.model.geo.addCurveLoop([-10001,10011,-10006,-10010], 20004)
gmsh.model.geo.addPlaneSurface([20004], 20004)  # owner element 1
gmsh.model.geo.addCurveLoop([-10000,-10009,-10007,-10011], 20005)
gmsh.model.geo.addPlaneSurface([20005], 20005)  # owner element 1
gmsh.model.geo.addCurveLoop([10012,10013,10014,10015], 20006)
gmsh.model.geo.addPlaneSurface([20006], 20006)  # owner element 2
gmsh.model.geo.addCurveLoop([10016,10017,10018,10019], 20007)
gmsh.model.geo.addPlaneSurface([20007], 20007)  # owner element 2
gmsh.model.geo.addCurveLoop([-10015,10020,-10016,10021], 20008)
gmsh.model.geo.addPlaneSurface([20008], 20008)  # owner element 2
gmsh.model.geo.addCurveLoop([-10014,10022,-10017,-10020], 20009)
gmsh.model.geo.addPlaneSurface([20009], 20009)  # owner element 2
gmsh.model.geo.addCurveLoop([-10013,10023,-10018,-10022], 20010)
gmsh.model.geo.addPlaneSurface([20010], 20010)  # owner element 2
gmsh.model.geo.addCurveLoop([-10012,-10021,-10019,-10023], 20011)
gmsh.model.geo.addPlaneSurface([20011], 20011)  # owner element 2
gmsh.model.geo.addCurveLoop([10024,10025,10026,10027], 20012)
gmsh.model.geo.addPlaneSurface([20012], 20012)  # owner element 3
gmsh.model.geo.addCurveLoop([10028,10029,10030,10031], 20013)
gmsh.model.geo.addPlaneSurface([20013], 20013)  # owner element 3
gmsh.model.geo.addCurveLoop([-10027,10032,-10028,10033], 20014)
gmsh.model.geo.addPlaneSurface([20014], 20014)  # owner element 3
gmsh.model.geo.addCurveLoop([-10026,10034,-10029,-10032], 20015)
gmsh.model.geo.addPlaneSurface([20015], 20015)  # owner element 3
gmsh.model.geo.addCurveLoop([-10025,10035,-10030,-10034], 20016)
gmsh.model.geo.addPlaneSurface([20016], 20016)  # owner element 3
gmsh.model.geo.addCurveLoop([-10024,-10033,-10031,-10035], 20017)
gmsh.model.geo.addPlaneSurface([20017], 20017)  # owner element 3
gmsh.model.geo.addCurveLoop([10036,10037,10038,10039], 20018)
gmsh.model.geo.addPlaneSurface([20018], 20018)  # owner element 4
gmsh.model.geo.addCurveLoop([10040,10041,10042,10043], 20019)
gmsh.model.geo.addPlaneSurface([20019], 20019)  # owner element 4
gmsh.model.geo.addCurveLoop([-10039,10044,-10040,10045], 20020)
gmsh.model.geo.addPlaneSurface([20020], 20020)  # owner element 4
gmsh.model.geo.addCurveLoop([-10038,10046,-10041,-10044], 20021)
gmsh.model.geo.addPlaneSurface([20021], 20021)  # owner element 4
gmsh.model.geo.addCurveLoop([-10037,10047,-10042,-10046], 20022)
gmsh.model.geo.addPlaneSurface([20022], 20022)  # owner element 4
gmsh.model.geo.addCurveLoop([-10036,-10045,-10043,-10047], 20023)
gmsh.model.geo.addPlaneSurface([20023], 20023)  # owner element 4
gmsh.model.geo.addCurveLoop([10048,10049,10050,10051], 20024)
gmsh.model.geo.addPlaneSurface([20024], 20024)  # owner element 5
gmsh.model.geo.addCurveLoop([10052,10053,10054,10055], 20025)
gmsh.model.geo.addPlaneSurface([20025], 20025)  # owner element 5
gmsh.model.geo.addCurveLoop([-10051,10056,-10052,10057], 20026)
gmsh.model.geo.addPlaneSurface([20026], 20026)  # owner element 5
gmsh.model.geo.addCurveLoop([-10050,10058,-10053,-10056], 20027)
gmsh.model.geo.addPlaneSurface([20027], 20027)  # owner element 5
gmsh.model.geo.addCurveLoop([-10049,10059,-10054,-10058], 20028)
gmsh.model.geo.addPlaneSurface([20028], 20028)  # owner element 5
gmsh.model.geo.addCurveLoop([-10048,-10057,-10055,-10059], 20029)
gmsh.model.geo.addPlaneSurface([20029], 20029)  # owner element 5
gmsh.model.geo.addCurveLoop([10060,10061,10062,10063], 20030)
gmsh.model.geo.addPlaneSurface([20030], 20030)  # owner element 6
gmsh.model.geo.addCurveLoop([-10063,10064,10015,10065], 20031)
gmsh.model.geo.addPlaneSurface([20031], 20031)  # owner element 6
gmsh.model.geo.addCurveLoop([-10062,10066,10014,-10064], 20032)
gmsh.model.geo.addPlaneSurface([20032], 20032)  # owner element 6
gmsh.model.geo.addCurveLoop([-10061,10067,10013,-10066], 20033)
gmsh.model.geo.addPlaneSurface([20033], 20033)  # owner element 6
gmsh.model.geo.addCurveLoop([-10060,-10065,10012,-10067], 20034)
gmsh.model.geo.addPlaneSurface([20034], 20034)  # owner element 6
gmsh.model.geo.addCurveLoop([10068,10069,10070,10071], 20035)
gmsh.model.geo.addPlaneSurface([20035], 20035)  # owner element 7
gmsh.model.geo.addCurveLoop([10072,10073,10074,10075], 20036)
gmsh.model.geo.addPlaneSurface([20036], 20036)  # owner element 7
gmsh.model.geo.addCurveLoop([-10071,10076,-10072,10077], 20037)
gmsh.model.geo.addPlaneSurface([20037], 20037)  # owner element 7
gmsh.model.geo.addCurveLoop([-10070,10078,-10073,-10076], 20038)
gmsh.model.geo.addPlaneSurface([20038], 20038)  # owner element 7
gmsh.model.geo.addCurveLoop([-10069,10079,-10074,-10078], 20039)
gmsh.model.geo.addPlaneSurface([20039], 20039)  # owner element 7
gmsh.model.geo.addCurveLoop([-10068,-10077,-10075,-10079], 20040)
gmsh.model.geo.addPlaneSurface([20040], 20040)  # owner element 7
gmsh.model.geo.addCurveLoop([-10038,10080,10081,10082], 20041)
gmsh.model.geo.addPlaneSurface([20041], 20041)  # owner element 8
gmsh.model.geo.addCurveLoop([10083,10084,10085,-10041], 20042)
gmsh.model.geo.addPlaneSurface([20042], 20042)  # owner element 8
gmsh.model.geo.addCurveLoop([-10082,10086,-10083,-10044], 20043)
gmsh.model.geo.addPlaneSurface([20043], 20043)  # owner element 8
gmsh.model.geo.addCurveLoop([-10081,10087,-10084,-10086], 20044)
gmsh.model.geo.addPlaneSurface([20044], 20044)  # owner element 8
gmsh.model.geo.addCurveLoop([-10080,10046,-10085,-10087], 20045)
gmsh.model.geo.addPlaneSurface([20045], 20045)  # owner element 8
gmsh.model.geo.addCurveLoop([-10081,10088,10089,10090], 20046)
gmsh.model.geo.addPlaneSurface([20046], 20046)  # owner element 9
gmsh.model.geo.addCurveLoop([10091,10092,10093,-10084], 20047)
gmsh.model.geo.addPlaneSurface([20047], 20047)  # owner element 9
gmsh.model.geo.addCurveLoop([-10090,10094,-10091,-10086], 20048)
gmsh.model.geo.addPlaneSurface([20048], 20048)  # owner element 9
gmsh.model.geo.addCurveLoop([-10089,10095,-10092,-10094], 20049)
gmsh.model.geo.addPlaneSurface([20049], 20049)  # owner element 9
gmsh.model.geo.addCurveLoop([-10088,10087,-10093,-10095], 20050)
gmsh.model.geo.addPlaneSurface([20050], 20050)  # owner element 9
gmsh.model.geo.addCurveLoop([10096,10097,10098,10099], 20051)
gmsh.model.geo.addPlaneSurface([20051], 20051)  # owner element 10
gmsh.model.geo.addCurveLoop([10004,10100,-10096,10101], 20052)
gmsh.model.geo.addPlaneSurface([20052], 20052)  # owner element 10
gmsh.model.geo.addCurveLoop([10005,10102,-10097,-10100], 20053)
gmsh.model.geo.addPlaneSurface([20053], 20053)  # owner element 10
gmsh.model.geo.addCurveLoop([10006,10103,-10098,-10102], 20054)
gmsh.model.geo.addPlaneSurface([20054], 20054)  # owner element 10
gmsh.model.geo.addCurveLoop([10007,-10101,-10099,-10103], 20055)
gmsh.model.geo.addPlaneSurface([20055], 20055)  # owner element 10
gmsh.model.geo.addCurveLoop([10104,10105,10106,10107], 20056)
gmsh.model.geo.addPlaneSurface([20056], 20056)  # owner element 11
gmsh.model.geo.addCurveLoop([10096,10108,-10104,10109], 20057)
gmsh.model.geo.addPlaneSurface([20057], 20057)  # owner element 11
gmsh.model.geo.addCurveLoop([10097,10110,-10105,-10108], 20058)
gmsh.model.geo.addPlaneSurface([20058], 20058)  # owner element 11
gmsh.model.geo.addCurveLoop([10098,10111,-10106,-10110], 20059)
gmsh.model.geo.addPlaneSurface([20059], 20059)  # owner element 11
gmsh.model.geo.addCurveLoop([10099,-10109,-10107,-10111], 20060)
gmsh.model.geo.addPlaneSurface([20060], 20060)  # owner element 11
gmsh.model.geo.addCurveLoop([10112,10113,10114,10115], 20061)
gmsh.model.geo.addPlaneSurface([20061], 20061)  # owner element 12
gmsh.model.geo.addCurveLoop([10052,10116,-10112,10117], 20062)
gmsh.model.geo.addPlaneSurface([20062], 20062)  # owner element 12
gmsh.model.geo.addCurveLoop([10053,10118,-10113,-10116], 20063)
gmsh.model.geo.addPlaneSurface([20063], 20063)  # owner element 12
gmsh.model.geo.addCurveLoop([10054,10119,-10114,-10118], 20064)
gmsh.model.geo.addPlaneSurface([20064], 20064)  # owner element 12
gmsh.model.geo.addCurveLoop([10055,-10117,-10115,-10119], 20065)
gmsh.model.geo.addPlaneSurface([20065], 20065)  # owner element 12
gmsh.model.geo.addCurveLoop([10120,10121,10122,10123], 20066)
gmsh.model.geo.addPlaneSurface([20066], 20066)  # owner element 13
gmsh.model.geo.addCurveLoop([10124,10125,10126,10127], 20067)
gmsh.model.geo.addPlaneSurface([20067], 20067)  # owner element 13
gmsh.model.geo.addCurveLoop([-10123,10128,-10124,10129], 20068)
gmsh.model.geo.addPlaneSurface([20068], 20068)  # owner element 13
gmsh.model.geo.addCurveLoop([-10122,10130,-10125,-10128], 20069)
gmsh.model.geo.addPlaneSurface([20069], 20069)  # owner element 13
gmsh.model.geo.addCurveLoop([-10121,10131,-10126,-10130], 20070)
gmsh.model.geo.addPlaneSurface([20070], 20070)  # owner element 13
gmsh.model.geo.addCurveLoop([-10120,-10129,-10127,-10131], 20071)
gmsh.model.geo.addPlaneSurface([20071], 20071)  # owner element 13
gmsh.model.geo.addCurveLoop([10132,10133,10134,10135], 20072)
gmsh.model.geo.addPlaneSurface([20072], 20072)  # owner element 14
gmsh.model.geo.addCurveLoop([10016,10136,-10132,10137], 20073)
gmsh.model.geo.addPlaneSurface([20073], 20073)  # owner element 14
gmsh.model.geo.addCurveLoop([10017,10138,-10133,-10136], 20074)
gmsh.model.geo.addPlaneSurface([20074], 20074)  # owner element 14
gmsh.model.geo.addCurveLoop([10018,10139,-10134,-10138], 20075)
gmsh.model.geo.addPlaneSurface([20075], 20075)  # owner element 14
gmsh.model.geo.addCurveLoop([10019,-10137,-10135,-10139], 20076)
gmsh.model.geo.addPlaneSurface([20076], 20076)  # owner element 14
gmsh.model.geo.addCurveLoop([10132,10140,10071,10141], 20077)
gmsh.model.geo.addPlaneSurface([20077], 20077)  # owner element 15
gmsh.model.geo.addCurveLoop([10133,10142,10070,-10140], 20078)
gmsh.model.geo.addPlaneSurface([20078], 20078)  # owner element 15
gmsh.model.geo.addCurveLoop([10134,10143,10069,-10142], 20079)
gmsh.model.geo.addPlaneSurface([20079], 20079)  # owner element 15
gmsh.model.geo.addCurveLoop([10135,-10141,10068,-10143], 20080)
gmsh.model.geo.addPlaneSurface([20080], 20080)  # owner element 15
gmsh.model.geo.addCurveLoop([10144,10145,10146,10147], 20081)
gmsh.model.geo.addPlaneSurface([20081], 20081)  # owner element 16
gmsh.model.geo.addCurveLoop([10112,10148,-10144,10149], 20082)
gmsh.model.geo.addPlaneSurface([20082], 20082)  # owner element 16
gmsh.model.geo.addCurveLoop([10113,10150,-10145,-10148], 20083)
gmsh.model.geo.addPlaneSurface([20083], 20083)  # owner element 16
gmsh.model.geo.addCurveLoop([10114,10151,-10146,-10150], 20084)
gmsh.model.geo.addPlaneSurface([20084], 20084)  # owner element 16
gmsh.model.geo.addCurveLoop([10115,-10149,-10147,-10151], 20085)
gmsh.model.geo.addPlaneSurface([20085], 20085)  # owner element 16
gmsh.model.geo.addCurveLoop([10144,10152,10123,10153], 20086)
gmsh.model.geo.addPlaneSurface([20086], 20086)  # owner element 17
gmsh.model.geo.addCurveLoop([10145,10154,10122,-10152], 20087)
gmsh.model.geo.addPlaneSurface([20087], 20087)  # owner element 17
gmsh.model.geo.addCurveLoop([10146,10155,10121,-10154], 20088)
gmsh.model.geo.addPlaneSurface([20088], 20088)  # owner element 17
gmsh.model.geo.addCurveLoop([10147,-10153,10120,-10155], 20089)
gmsh.model.geo.addPlaneSurface([20089], 20089)  # owner element 17
gmsh.model.geo.addCurveLoop([10156,10157,10158,10159], 20090)
gmsh.model.geo.addPlaneSurface([20090], 20090)  # owner element 18
gmsh.model.geo.addCurveLoop([10028,10160,-10156,10161], 20091)
gmsh.model.geo.addPlaneSurface([20091], 20091)  # owner element 18
gmsh.model.geo.addCurveLoop([10029,10162,-10157,-10160], 20092)
gmsh.model.geo.addPlaneSurface([20092], 20092)  # owner element 18
gmsh.model.geo.addCurveLoop([10030,10163,-10158,-10162], 20093)
gmsh.model.geo.addPlaneSurface([20093], 20093)  # owner element 18
gmsh.model.geo.addCurveLoop([10031,-10161,-10159,-10163], 20094)
gmsh.model.geo.addPlaneSurface([20094], 20094)  # owner element 18
gmsh.model.geo.addCurveLoop([10164,10165,10166,10167], 20095)
gmsh.model.geo.addPlaneSurface([20095], 20095)  # owner element 19
gmsh.model.geo.addCurveLoop([10156,10168,-10164,10169], 20096)
gmsh.model.geo.addPlaneSurface([20096], 20096)  # owner element 19
gmsh.model.geo.addCurveLoop([10157,10170,-10165,-10168], 20097)
gmsh.model.geo.addPlaneSurface([20097], 20097)  # owner element 19
gmsh.model.geo.addCurveLoop([10158,10171,-10166,-10170], 20098)
gmsh.model.geo.addPlaneSurface([20098], 20098)  # owner element 19
gmsh.model.geo.addCurveLoop([10159,-10169,-10167,-10171], 20099)
gmsh.model.geo.addPlaneSurface([20099], 20099)  # owner element 19

gmsh.model.geo.addSurfaceLoop([20000,20001,20002,20003,20004,20005], 30001)
gmsh.model.geo.addVolume([30001], 1)
gmsh.model.geo.addSurfaceLoop([20006,20007,20008,20009,20010,20011], 30002)
gmsh.model.geo.addVolume([30002], 2)
gmsh.model.geo.addSurfaceLoop([20012,20013,20014,20015,20016,20017], 30003)
gmsh.model.geo.addVolume([30003], 3)
gmsh.model.geo.addSurfaceLoop([20018,20019,20020,20021,20022,20023], 30004)
gmsh.model.geo.addVolume([30004], 4)
gmsh.model.geo.addSurfaceLoop([20024,20025,20026,20027,20028,20029], 30005)
gmsh.model.geo.addVolume([30005], 5)
gmsh.model.geo.addSurfaceLoop([20030,20006,20031,20032,20033,20034], 30006)
gmsh.model.geo.addVolume([30006], 6)
gmsh.model.geo.addSurfaceLoop([20035,20036,20037,20038,20039,20040], 30007)
gmsh.model.geo.addVolume([30007], 7)
gmsh.model.geo.addSurfaceLoop([20041,20042,20043,20044,20045,20021], 30008)
gmsh.model.geo.addVolume([30008], 8)
gmsh.model.geo.addSurfaceLoop([20046,20047,20048,20049,20050,20044], 30009)
gmsh.model.geo.addVolume([30009], 9)
gmsh.model.geo.addSurfaceLoop([20001,20051,20052,20053,20054,20055], 30010)
gmsh.model.geo.addVolume([30010], 10)
gmsh.model.geo.addSurfaceLoop([20051,20056,20057,20058,20059,20060], 30011)
gmsh.model.geo.addVolume([30011], 11)
gmsh.model.geo.addSurfaceLoop([20025,20061,20062,20063,20064,20065], 30012)
gmsh.model.geo.addVolume([30012], 12)
gmsh.model.geo.addSurfaceLoop([20066,20067,20068,20069,20070,20071], 30013)
gmsh.model.geo.addVolume([30013], 13)
gmsh.model.geo.addSurfaceLoop([20007,20072,20073,20074,20075,20076], 30014)
gmsh.model.geo.addVolume([30014], 14)
gmsh.model.geo.addSurfaceLoop([20072,20035,20077,20078,20079,20080], 30015)
gmsh.model.geo.addVolume([30015], 15)
gmsh.model.geo.addSurfaceLoop([20061,20081,20082,20083,20084,20085], 30016)
gmsh.model.geo.addVolume([30016], 16)
gmsh.model.geo.addSurfaceLoop([20081,20066,20086,20087,20088,20089], 30017)
gmsh.model.geo.addVolume([30017], 17)
gmsh.model.geo.addSurfaceLoop([20013,20090,20091,20092,20093,20094], 30018)
gmsh.model.geo.addVolume([30018], 18)
gmsh.model.geo.addSurfaceLoop([20090,20095,20096,20097,20098,20099], 30019)
gmsh.model.geo.addVolume([30019], 19)

gmsh.model.geo.synchronize()

gmsh.model.mesh.setTransfiniteCurve(10000, 2)
gmsh.model.mesh.setTransfiniteCurve(10001, 2)
gmsh.model.mesh.setTransfiniteCurve(10002, 2)
gmsh.model.mesh.setTransfiniteCurve(10003, 2)
gmsh.model.mesh.setTransfiniteCurve(10004, 2)
gmsh.model.mesh.setTransfiniteCurve(10005, 2)
gmsh.model.mesh.setTransfiniteCurve(10006, 2)
gmsh.model.mesh.setTransfiniteCurve(10007, 2)
gmsh.model.mesh.setTransfiniteCurve(10008, 2)
gmsh.model.mesh.setTransfiniteCurve(10009, 2)
gmsh.model.mesh.setTransfiniteCurve(10010, 2)
gmsh.model.mesh.setTransfiniteCurve(10011, 2)
gmsh.model.mesh.setTransfiniteCurve(10012, 2)
gmsh.model.mesh.setTransfiniteCurve(10013, 2)
gmsh.model.mesh.setTransfiniteCurve(10014, 2)
gmsh.model.mesh.setTransfiniteCurve(10015, 2)
gmsh.model.mesh.setTransfiniteCurve(10016, 2)
gmsh.model.mesh.setTransfiniteCurve(10017, 2)
gmsh.model.mesh.setTransfiniteCurve(10018, 2)
gmsh.model.mesh.setTransfiniteCurve(10019, 2)
gmsh.model.mesh.setTransfiniteCurve(10020, 2)
gmsh.model.mesh.setTransfiniteCurve(10021, 2)
gmsh.model.mesh.setTransfiniteCurve(10022, 2)
gmsh.model.mesh.setTransfiniteCurve(10023, 2)
gmsh.model.mesh.setTransfiniteCurve(10024, 2)
gmsh.model.mesh.setTransfiniteCurve(10025, 2)
gmsh.model.mesh.setTransfiniteCurve(10026, 2)
gmsh.model.mesh.setTransfiniteCurve(10027, 2)
gmsh.model.mesh.setTransfiniteCurve(10028, 2)
gmsh.model.mesh.setTransfiniteCurve(10029, 2)
gmsh.model.mesh.setTransfiniteCurve(10030, 2)
gmsh.model.mesh.setTransfiniteCurve(10031, 2)
gmsh.model.mesh.setTransfiniteCurve(10032, 2)
gmsh.model.mesh.setTransfiniteCurve(10033, 2)
gmsh.model.mesh.setTransfiniteCurve(10034, 2)
gmsh.model.mesh.setTransfiniteCurve(10035, 2)
gmsh.model.mesh.setTransfiniteCurve(10036, 2)
gmsh.model.mesh.setTransfiniteCurve(10037, 2)
gmsh.model.mesh.setTransfiniteCurve(10038, 2)
gmsh.model.mesh.setTransfiniteCurve(10039, 2)
gmsh.model.mesh.setTransfiniteCurve(10040, 2)
gmsh.model.mesh.setTransfiniteCurve(10041, 2)
gmsh.model.mesh.setTransfiniteCurve(10042, 2)
gmsh.model.mesh.setTransfiniteCurve(10043, 2)
gmsh.model.mesh.setTransfiniteCurve(10044, 2)
gmsh.model.mesh.setTransfiniteCurve(10045, 2)
gmsh.model.mesh.setTransfiniteCurve(10046, 2)
gmsh.model.mesh.setTransfiniteCurve(10047, 2)
gmsh.model.mesh.setTransfiniteCurve(10048, 2)
gmsh.model.mesh.setTransfiniteCurve(10049, 2)
gmsh.model.mesh.setTransfiniteCurve(10050, 2)
gmsh.model.mesh.setTransfiniteCurve(10051, 2)
gmsh.model.mesh.setTransfiniteCurve(10052, 2)
gmsh.model.mesh.setTransfiniteCurve(10053, 2)
gmsh.model.mesh.setTransfiniteCurve(10054, 2)
gmsh.model.mesh.setTransfiniteCurve(10055, 2)
gmsh.model.mesh.setTransfiniteCurve(10056, 2)
gmsh.model.mesh.setTransfiniteCurve(10057, 2)
gmsh.model.mesh.setTransfiniteCurve(10058, 2)
gmsh.model.mesh.setTransfiniteCurve(10059, 2)
gmsh.model.mesh.setTransfiniteCurve(10060, 2)
gmsh.model.mesh.setTransfiniteCurve(10061, 2)
gmsh.model.mesh.setTransfiniteCurve(10062, 2)
gmsh.model.mesh.setTransfiniteCurve(10063, 2)
gmsh.model.mesh.setTransfiniteCurve(10064, 2)
gmsh.model.mesh.setTransfiniteCurve(10065, 2)
gmsh.model.mesh.setTransfiniteCurve(10066, 2)
gmsh.model.mesh.setTransfiniteCurve(10067, 2)
gmsh.model.mesh.setTransfiniteCurve(10068, 2)
gmsh.model.mesh.setTransfiniteCurve(10069, 2)
gmsh.model.mesh.setTransfiniteCurve(10070, 2)
gmsh.model.mesh.setTransfiniteCurve(10071, 2)
gmsh.model.mesh.setTransfiniteCurve(10072, 2)
gmsh.model.mesh.setTransfiniteCurve(10073, 2)
gmsh.model.mesh.setTransfiniteCurve(10074, 2)
gmsh.model.mesh.setTransfiniteCurve(10075, 2)
gmsh.model.mesh.setTransfiniteCurve(10076, 2)
gmsh.model.mesh.setTransfiniteCurve(10077, 2)
gmsh.model.mesh.setTransfiniteCurve(10078, 2)
gmsh.model.mesh.setTransfiniteCurve(10079, 2)
gmsh.model.mesh.setTransfiniteCurve(10080, 2)
gmsh.model.mesh.setTransfiniteCurve(10081, 2)
gmsh.model.mesh.setTransfiniteCurve(10082, 2)
gmsh.model.mesh.setTransfiniteCurve(10083, 2)
gmsh.model.mesh.setTransfiniteCurve(10084, 2)
gmsh.model.mesh.setTransfiniteCurve(10085, 2)
gmsh.model.mesh.setTransfiniteCurve(10086, 2)
gmsh.model.mesh.setTransfiniteCurve(10087, 2)
gmsh.model.mesh.setTransfiniteCurve(10088, 2)
gmsh.model.mesh.setTransfiniteCurve(10089, 2)
gmsh.model.mesh.setTransfiniteCurve(10090, 2)
gmsh.model.mesh.setTransfiniteCurve(10091, 2)
gmsh.model.mesh.setTransfiniteCurve(10092, 2)
gmsh.model.mesh.setTransfiniteCurve(10093, 2)
gmsh.model.mesh.setTransfiniteCurve(10094, 2)
gmsh.model.mesh.setTransfiniteCurve(10095, 2)
gmsh.model.mesh.setTransfiniteCurve(10096, 2)
gmsh.model.mesh.setTransfiniteCurve(10097, 2)
gmsh.model.mesh.setTransfiniteCurve(10098, 2)
gmsh.model.mesh.setTransfiniteCurve(10099, 2)
gmsh.model.mesh.setTransfiniteCurve(10100, 2)
gmsh.model.mesh.setTransfiniteCurve(10101, 2)
gmsh.model.mesh.setTransfiniteCurve(10102, 2)
gmsh.model.mesh.setTransfiniteCurve(10103, 2)
gmsh.model.mesh.setTransfiniteCurve(10104, 2)
gmsh.model.mesh.setTransfiniteCurve(10105, 2)
gmsh.model.mesh.setTransfiniteCurve(10106, 2)
gmsh.model.mesh.setTransfiniteCurve(10107, 2)
gmsh.model.mesh.setTransfiniteCurve(10108, 2)
gmsh.model.mesh.setTransfiniteCurve(10109, 2)
gmsh.model.mesh.setTransfiniteCurve(10110, 2)
gmsh.model.mesh.setTransfiniteCurve(10111, 2)
gmsh.model.mesh.setTransfiniteCurve(10112, 2)
gmsh.model.mesh.setTransfiniteCurve(10113, 2)
gmsh.model.mesh.setTransfiniteCurve(10114, 2)
gmsh.model.mesh.setTransfiniteCurve(10115, 2)
gmsh.model.mesh.setTransfiniteCurve(10116, 2)
gmsh.model.mesh.setTransfiniteCurve(10117, 2)
gmsh.model.mesh.setTransfiniteCurve(10118, 2)
gmsh.model.mesh.setTransfiniteCurve(10119, 2)
gmsh.model.mesh.setTransfiniteCurve(10120, 2)
gmsh.model.mesh.setTransfiniteCurve(10121, 2)
gmsh.model.mesh.setTransfiniteCurve(10122, 2)
gmsh.model.mesh.setTransfiniteCurve(10123, 2)
gmsh.model.mesh.setTransfiniteCurve(10124, 2)
gmsh.model.mesh.setTransfiniteCurve(10125, 2)
gmsh.model.mesh.setTransfiniteCurve(10126, 2)
gmsh.model.mesh.setTransfiniteCurve(10127, 2)
gmsh.model.mesh.setTransfiniteCurve(10128, 2)
gmsh.model.mesh.setTransfiniteCurve(10129, 2)
gmsh.model.mesh.setTransfiniteCurve(10130, 2)
gmsh.model.mesh.setTransfiniteCurve(10131, 2)
gmsh.model.mesh.setTransfiniteCurve(10132, 2)
gmsh.model.mesh.setTransfiniteCurve(10133, 2)
gmsh.model.mesh.setTransfiniteCurve(10134, 2)
gmsh.model.mesh.setTransfiniteCurve(10135, 2)
gmsh.model.mesh.setTransfiniteCurve(10136, 2)
gmsh.model.mesh.setTransfiniteCurve(10137, 2)
gmsh.model.mesh.setTransfiniteCurve(10138, 2)
gmsh.model.mesh.setTransfiniteCurve(10139, 2)
gmsh.model.mesh.setTransfiniteCurve(10140, 2)
gmsh.model.mesh.setTransfiniteCurve(10141, 2)
gmsh.model.mesh.setTransfiniteCurve(10142, 2)
gmsh.model.mesh.setTransfiniteCurve(10143, 2)
gmsh.model.mesh.setTransfiniteCurve(10144, 2)
gmsh.model.mesh.setTransfiniteCurve(10145, 2)
gmsh.model.mesh.setTransfiniteCurve(10146, 2)
gmsh.model.mesh.setTransfiniteCurve(10147, 2)
gmsh.model.mesh.setTransfiniteCurve(10148, 2)
gmsh.model.mesh.setTransfiniteCurve(10149, 2)
gmsh.model.mesh.setTransfiniteCurve(10150, 2)
gmsh.model.mesh.setTransfiniteCurve(10151, 2)
gmsh.model.mesh.setTransfiniteCurve(10152, 2)
gmsh.model.mesh.setTransfiniteCurve(10153, 2)
gmsh.model.mesh.setTransfiniteCurve(10154, 2)
gmsh.model.mesh.setTransfiniteCurve(10155, 2)
gmsh.model.mesh.setTransfiniteCurve(10156, 2)
gmsh.model.mesh.setTransfiniteCurve(10157, 2)
gmsh.model.mesh.setTransfiniteCurve(10158, 2)
gmsh.model.mesh.setTransfiniteCurve(10159, 2)
gmsh.model.mesh.setTransfiniteCurve(10160, 2)
gmsh.model.mesh.setTransfiniteCurve(10161, 2)
gmsh.model.mesh.setTransfiniteCurve(10162, 2)
gmsh.model.mesh.setTransfiniteCurve(10163, 2)
gmsh.model.mesh.setTransfiniteCurve(10164, 2)
gmsh.model.mesh.setTransfiniteCurve(10165, 2)
gmsh.model.mesh.setTransfiniteCurve(10166, 2)
gmsh.model.mesh.setTransfiniteCurve(10167, 2)
gmsh.model.mesh.setTransfiniteCurve(10168, 2)
gmsh.model.mesh.setTransfiniteCurve(10169, 2)
gmsh.model.mesh.setTransfiniteCurve(10170, 2)
gmsh.model.mesh.setTransfiniteCurve(10171, 2)
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
gmsh.model.mesh.setTransfiniteVolume(1, [1,2,3,4,65,73,76,66])
gmsh.model.mesh.setRecombine(3, 1)
gmsh.model.mesh.setTransfiniteVolume(2, [45,46,47,48,81,82,83,84])
gmsh.model.mesh.setRecombine(3, 2)
gmsh.model.mesh.setTransfiniteVolume(3, [17,18,19,20,97,98,99,100])
gmsh.model.mesh.setRecombine(3, 3)
gmsh.model.mesh.setTransfiniteVolume(4, [25,57,58,28,29,61,62,32])
gmsh.model.mesh.setRecombine(3, 4)
gmsh.model.mesh.setTransfiniteVolume(5, [33,34,35,36,74,69,70,75])
gmsh.model.mesh.setRecombine(3, 5)
gmsh.model.mesh.setTransfiniteVolume(6, [41,42,43,44,45,46,47,48])
gmsh.model.mesh.setRecombine(3, 6)
gmsh.model.mesh.setTransfiniteVolume(7, [49,50,51,52,53,54,55,56])
gmsh.model.mesh.setRecombine(3, 7)
gmsh.model.mesh.setTransfiniteVolume(8, [57,59,60,58,61,63,64,62])
gmsh.model.mesh.setRecombine(3, 8)
gmsh.model.mesh.setTransfiniteVolume(9, [59,26,27,60,63,30,31,64])
gmsh.model.mesh.setRecombine(3, 9)
gmsh.model.mesh.setTransfiniteVolume(10, [65,73,76,66,67,77,80,68])
gmsh.model.mesh.setRecombine(3, 10)
gmsh.model.mesh.setTransfiniteVolume(11, [67,77,80,68,5,6,7,8])
gmsh.model.mesh.setRecombine(3, 11)
gmsh.model.mesh.setTransfiniteVolume(12, [74,69,70,75,89,93,94,90])
gmsh.model.mesh.setRecombine(3, 12)
gmsh.model.mesh.setTransfiniteVolume(13, [78,71,72,79,37,38,39,40])
gmsh.model.mesh.setRecombine(3, 13)
gmsh.model.mesh.setTransfiniteVolume(14, [81,82,83,84,85,86,87,88])
gmsh.model.mesh.setRecombine(3, 14)
gmsh.model.mesh.setTransfiniteVolume(15, [85,86,87,88,49,50,51,52])
gmsh.model.mesh.setRecombine(3, 15)
gmsh.model.mesh.setTransfiniteVolume(16, [89,93,94,90,91,95,96,92])
gmsh.model.mesh.setRecombine(3, 16)
gmsh.model.mesh.setTransfiniteVolume(17, [91,95,96,92,78,71,72,79])
gmsh.model.mesh.setRecombine(3, 17)
gmsh.model.mesh.setTransfiniteVolume(18, [97,98,99,100,101,102,103,104])
gmsh.model.mesh.setRecombine(3, 18)
gmsh.model.mesh.setTransfiniteVolume(19, [101,102,103,104,21,22,23,24])
gmsh.model.mesh.setRecombine(3, 19)

for name, tags in PHYSICAL_VOLUMES.items():
    group = gmsh.model.addPhysicalGroup(3, tags, PHYSICAL_GROUP_IDS[3][name])
    gmsh.model.setPhysicalName(3, group, name)
for name, tags in PHYSICAL_SURFACES.items():
    group = gmsh.model.addPhysicalGroup(2, tags, PHYSICAL_GROUP_IDS[2][name])
    gmsh.model.setPhysicalName(2, group, name)

gmsh.model.mesh.generate(3)
gmsh.write(OUT_MSH)
gmsh.finalize()
print(OUT_MSH)

