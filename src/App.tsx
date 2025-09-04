import { SchemaViewer } from "@/ui/SchemaViewer";
import { Schema } from "@/lib/definitions";

const placeholderSchemas: Schema[] = [
  {
    name: "MatSci Schema",
    classes: [
      {
        name: "Material",
        description:
          "Materials that are used in the synthesis of the target. For example: Cr2O3, Strontium carbonate, BaTiO3, Li2CO3, Water, Ethanol",
        instances: [{ id: 0, description: "Test Entity", content: "content" }],
      },
      {
        name: "Nonrecipe Material",
        description:
          "Chemically specified\n" +
          " materials that are not used in the synthesis of\n" +
          " the synthesis target. For example: “BaTiO3\n" +
          " powder (Ba/Ti=0.999)”, “Li2CO3 was used as\n" +
          " the Li source”, “Si/Al ratio was 5”",
        instances: [],
      },
      {
        name: "Operation",
        description:
          "Discrete actions physically performed by the researcher or discrete process\n" +
          "steps taken to synthesize the target.",
        instances: [],
      },
      {
        name: "Material Descriptor",
        description:
          "Describes a material’s structure, shape, form, type, role, etc.\n" +
          "and must be directly or nearly adjacent to\n" +
          "the material it describes. Does not include amounts, concentrations, " +
          "or purities of materials. For example: CaCu3Ti4O12 compound,\n" +
          "Copper ion, GaAs nanowires, Anatase TiO2\n" +
          ", Deionized water ",
        instances: [],
      },
      {
        name: "Meta",
        description:
          "A canonical name to specify a particular overall synthesis method used for synthesis. For example: “Graphite oxide was prepared by oxidation of graphite powder according to the modified Hummers’ method”. “Bi2S3 nanorods with orthorhombic structure were prepared through the hydrothermal method”. “Graphene oxide (GO) was prepared from graphite powder by the Staudenmaier method.”",
        instances: [],
      },
      {
        name: "Amount Unit",
        description:
          "These describe absolute amounts, concentrations, purities, ratios, flow rates and so on. For example: mg, mL, M, %.",
        instances: [],
      },
      {
        name: "Condition Unit",
        description:
          "These describe the units of measurement for intangible conditions under which operations are performed. For example: °C, K, sec, RPM, mW.",
        instances: [],
      },
      {
        name: "Condition Misc",
        description:
          "Qualitative descriptions of conditions. For example: Room temperature, Dropwise, Naturally, Vacuum.",
        instances: [],
      },
      {
        name: "Synthesis Apparatus",
        description:
          "Equipment used to perform an operation involved in the synthesis.",
        instances: [],
      },
      {
        name: "Characterization Apparatus",
        description: "Equipment used to characterize a material’s properties.",
        instances: [],
      },
    ],
  },
];

export default function Page() {
  return <SchemaViewer schemas={placeholderSchemas}></SchemaViewer>;
}
