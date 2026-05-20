<template>
  <div class="spmv-container">
    <div v-loading="loading" class="page-card">
      <div class="page-back" @click="proxy.$router.go(-1)">
        <img class="img" src="@/assets/images/back.png" />
        <span>返回</span>
      </div>
      <div class="page-title">QiWu - SpMV</div>

      <div class="page-navbar">
        <el-link type="primary" @click="handleSource">Source</el-link>
        <el-divider direction="vertical" />
        <el-link type="primary" @click="handleSummit">Submit your code</el-link>
        <el-divider direction="vertical" />
        <el-link type="primary" @click="handleSubmitResult">
          Submit your result
        </el-link>
        <el-divider direction="vertical" />
        <el-link type="primary" @click="handleTemplate">
          Download CSV template
        </el-link>
        <el-divider direction="vertical" />
        <el-link type="primary" @click="handleResult">Download results</el-link>
      </div>

      <div class="page-search">
        <el-form
          ref="searchFormRef"
          :model="state.searchForm"
          label-width="auto"
        >
          <el-row :gutter="20">
            <el-col :span="24">
              <el-form-item label="Machine&Compiler：" prop="machineCompiler">
                <el-radio-group
                  v-model="state.searchForm.machineCompiler"
                  @change="filterData"
                >
                  <el-radio
                    v-for="(item, index) in machineCompilerOptins"
                    :key="index"
                    :value="item"
                    border
                    >{{ item }}</el-radio
                  >
                </el-radio-group>
              </el-form-item>
            </el-col>

            <el-col :span="24">
              <el-form-item label="DataTyper：" prop="dataType">
                <el-radio-group
                  v-model="state.searchForm.dataType"
                  @change="filterData"
                >
                  <el-radio
                    v-for="(item, index) in dataTypeOptins"
                    :key="index"
                    :value="item"
                    border
                    >{{ item }}</el-radio
                  >
                </el-radio-group>
              </el-form-item>
            </el-col>

            <el-col :span="24">
              <el-form-item label="time phase：" prop="timePhase">
                <el-radio-group
                  v-model="state.searchForm.timePhase"
                  @change="filterData"
                >
                  <el-radio
                    v-for="(item, index) in timePhaseOptins"
                    :key="index"
                    :value="item"
                    border
                    >{{ item }}</el-radio
                  >
                </el-radio-group>
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>
      </div>

      <div v-if="state.tableData.length" class="kernel-source">
        <div class="default-title" style="margin-bottom: 50px">
          Kernel Source
        </div>
        <div class="bar-title">
          <div class="title">GeoMean Speedup (Higher is better).</div>
          <div class="subtitle">
            Different colors on the bar chart represent the same values shown at
            different scales (1x, 10x, 100x zoom)
          </div>
        </div>
        <div class="bar-group">
          <div
            class="bar-item"
            v-for="(bar, index) in state.tableData"
            :key="index"
          >
            <div
              class="bar-label"
              :class="{ 'open-source': bar['openSource'] === 'Y' }"
            >
              {{ bar.Kernel }}
            </div>
            <MultiplierBar :value="bar['Matrix-all'] || 0" :maxValue="1000" />
          </div>
        </div>
      </div>

      <div v-if="state.tableData.length" class="time">
        <div class="default-title">time[ms]</div>
        <div class="time-legend">
          <el-tooltip
            v-for="(value, key, index) in colorMap"
            :key="index"
            :content="getLegendLabel(key)"
            placement="top"
            effect="dark"
          >
            <div class="legend-item" :style="{ backgroundColor: value }"></div>
          </el-tooltip>
        </div>
        <div class="time-tips">
          show 100 items only，download results for more detail
        </div>
        <div class="time-table">
          <el-scrollbar
            max-height="calc(100vh - 280px)"
            class="table-scrollbar"
          >
            <div class="table-wrapper">
              <table class="data-table">
                <thead>
                  <tr>
                    <th class="mat-header sticky-cell"></th>
                    <th
                      v-for="(item, index) in state.tableData"
                      :key="index"
                      class="kernel-header"
                    >
                      {{ item.Kernel }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(mat, matIndex) in matList" :key="matIndex">
                    <td class="mat-cell sticky-cell">{{ mat }}</td>
                    <td
                      v-for="(item, index) in state.tableData"
                      :key="index"
                      class="data-cell"
                      :style="{
                        backgroundColor: formatCellbgcolor(item[mat], mat),
                      }"
                    >
                      {{ item[mat] || "" }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </el-scrollbar>
        </div>
      </div>
      <!-- 缺省 -->
      <div v-if="!state.tableData.length" class="nothing-selected">
        Nothing selected
      </div>
    </div>
  </div>
</template>
<script setup>
import MultiplierBar from "./components/MultiplierBar.vue";

const { proxy } = getCurrentInstance();

const sourceData = ref([]);
const machineCompilerOptins = ref([]);
const dataTypeOptins = ref([]);
const timePhaseOptins = ref([]);
const matList = ref([]);
const loading = ref(false);
const state = reactive({
  searchForm: {
    machineCompiler: "",
    dataType: "",
    timePhase: "",
  },
  tableData: [], // 渲染数据
  baseData: null, // 基准数据
});

// 定义颜色映射：绿色系表示更好（值更小），红色系表示更差（值更大）
const colorMap = {
  lessThan100: "#d5f8b5", // -100%以下
  lessThan80: "#CDFF7F", // -80% ~ -100%
  lessThan60: "#B0FF35", // -60% ~ -80%
  lessThan40: "#95F204 ", // -40% ~ -60%
  lessThan20: "#5CEB00", // -20% ~ -40%
  lessThan0: "#50DA03", // 0% ~ -20%
  betterThan: "#1AD300", // 基准值 0
  moreThan0: "#FFCF8F", // 0% ~ +20%
  moreThan20: "#F1B15C", // +20% ~ +40%
  moreThan40: "#DA9437", // +40% ~ +60%
  moreThan60: "#B8741A", // +60% ~ +80%
  moreThan80: "#df6a45", // +80% ~ +100%
  moreThan100: "#df562c", // +100%以上
};

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i += 1;
      }
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  return rows.filter((item) => item.some((cell) => cell !== ""));
};

const getUniqueColumnValues = (rows, columnIndex) => {
  const values = rows
    .map((row) =>
      row[columnIndex] !== undefined && row[columnIndex] !== null
        ? String(row[columnIndex]).trim()
        : "",
    )
    .filter((value) => value !== "");

  return [...new Set(values)];
};

// 获取file文件数据
const loadCsvData = async () => {
  loading.value = true;
  try {
    // 获取 CSV 文件 - 使用 BASE_URL 确保在 GitHub Pages 子路径部署时也能正确访问
    const response = await fetch(`${import.meta.env.BASE_URL}file/SPMV.csv`);
    const csvText = await response.text();

    const csvData = parseCsv(csvText);
    if (csvData.length > 0) {
      // 第一行作为列名
      const headers = csvData[0];
      const dataRows = csvData.slice(2);
      const rows = dataRows.map((row) => {
        const obj = {};
        headers.forEach((header, index) => {
          obj[header] = row[index] || "";
        });
        return obj;
      });

      sourceData.value = rows;
      const allMatList = headers.slice(7);
      matList.value =
        allMatList.length > 100 ? allMatList.slice(0, 100) : allMatList;
      machineCompilerOptins.value = getUniqueColumnValues(dataRows, 1);
      dataTypeOptins.value = getUniqueColumnValues(dataRows, 2);
      timePhaseOptins.value = getUniqueColumnValues(dataRows, 5);

      if (machineCompilerOptins.value.length) {
        state.searchForm.machineCompiler = machineCompilerOptins.value[0];
      }
      if (dataTypeOptins.value.length) {
        state.searchForm.dataType = dataTypeOptins.value[0];
      }
      if (timePhaseOptins.value.length) {
        state.searchForm.timePhase = timePhaseOptins.value[0];
      }

      loading.value = false;
      filterData();
    }
  } catch (error) {
    loading.value = false;
    console.error(
      "尝试访问的路径:",
      `${import.meta.env.BASE_URL}file/SPMV.csv`,
    );
    proxy.$message.error("加载数据文件失败，请检查文件路径");
  }
};

// 筛选数据
const filterData = () => {
  // console.log("state.searchForm", state.searchForm);
  // console.log("sourceData", sourceData.value);

  state.tableData = sourceData.value.filter((item) => {
    let result = true;
    if (state.searchForm.machineCompiler) {
      result =
        result && item["Machine&Compiler"] === state.searchForm.machineCompiler;
      // console.log("Machine&Compiler", result);
    }
    if (state.searchForm.dataType) {
      result = result && item["DataType"] === state.searchForm.dataType;
      // console.log("DataType", result);
    }
    if (state.searchForm.timePhase) {
      result = result && item["time phase"] === state.searchForm.timePhase;
      // console.log("time phase", result);
    }
    return result;
  });

  state.baseData = state.tableData.find((item) => item["Baseline tag"] === "T");

  // 排序：Baseline tag 为 T 的排第一，其余按 Matrix-all 从大到小排序
  state.tableData.sort((a, b) => {
    const isABaseline = a["Baseline tag"] === "T";
    const isBBaseline = b["Baseline tag"] === "T";

    // 如果 a 是 baseline，排在前面
    if (isABaseline && !isBBaseline) return -1;
    // 如果 b 是 baseline，排在前面
    if (!isABaseline && isBBaseline) return 1;
    // 如果都是或都不是 baseline，按 Matrix-all 排序
    const aValue = parseFloat(a["Matrix-all"]) || 0;
    const bValue = parseFloat(b["Matrix-all"]) || 0;
    return bValue - aValue;
  });

  console.log("state.tableData", state.tableData);
  console.log("state.baseData", state.baseData);
};

// 颜色处理
const formatCellbgcolor = (value, mat) => {
  const baseMatValue = state.baseData?.[mat];

  // 如果没有基准值或当前值为空，返回白色
  if (!baseMatValue || !value || value === "") {
    return "#ffffff";
  }

  const baseValue = parseFloat(baseMatValue);
  const currentValue = parseFloat(value);

  // 如果解析失败，返回白色
  if (isNaN(baseValue) || isNaN(currentValue)) {
    return "#ffffff";
  }

  // 计算差异百分比：(当前值 - 基准值) / 基准值 * 100
  const diffPercent = ((currentValue - baseValue) / baseValue) * 100;

  // 根据差异百分比返回对应颜色
  if (diffPercent <= -100) return colorMap.lessThan100;
  if (diffPercent <= -80) return colorMap.lessThan80;
  if (diffPercent <= -60) return colorMap.lessThan60;
  if (diffPercent <= -40) return colorMap.lessThan40;
  if (diffPercent <= -20) return colorMap.lessThan20;
  if (diffPercent < 0) return colorMap.lessThan0;
  if (diffPercent === 0) return colorMap.betterThan;
  if (diffPercent < 20) return colorMap.moreThan0;
  if (diffPercent < 40) return colorMap.moreThan20;
  if (diffPercent < 60) return colorMap.moreThan40;
  if (diffPercent < 80) return colorMap.moreThan60;
  if (diffPercent < 100) return colorMap.moreThan80;
  return colorMap.moreThan100;
};

// 获取图例标签
const getLegendLabel = (key) => {
  const labels = {
    lessThan100: "< -100%",
    lessThan80: "-100% ~ -80%",
    lessThan60: "-80% ~ -60%",
    lessThan40: "-60% ~ -40%",
    lessThan20: "-40% ~ -20%",
    lessThan0: "-20% ~ 0%",
    betterThan: "0% (Baseline)",
    moreThan0: "0% ~ +20%",
    moreThan20: "+20% ~ +40%",
    moreThan40: "+40% ~ +60%",
    moreThan60: "+60% ~ +80%",
    moreThan80: "+80% ~ +100%",
    moreThan100: "> +100%",
  };
  return labels[key] || "";
};

// Source
const handleSource = () => {
  window.open("https://github.com/QiWu-NCIC/QiWu-SpMV", "_blank");
};

//
const handleSummit = () => {
  window.open("https://github.com/QiWu-NCIC/QiWu-SpMV", "_blank");
};

// Submit result
const handleSubmitResult = () => {
  const title = encodeURIComponent("[SPMV Result] ");
  window.open(
    `https://github.com/QiWu-NCIC/databank-alpha/issues/new?template=spmv-result.yml&title=${title}`,
    "_blank",
  );
};

// Download CSV template
const handleTemplate = () => {
  window.open(`${import.meta.env.BASE_URL}file/SPMV-template.csv`, "_blank");
};

// 修改结果文件
const handleResult = () => {
  window.open(
    "https://github.com/QiWu-NCIC/databank-alpha/tree/main/public/file",
    "_blank",
  );
};

onMounted(() => {
  loadCsvData();
});
</script>
<style lang="scss" scoped>
.spmv-container {
  min-height: 100%;
  background: #ebf7ff;
  padding: 30px 10%;
  display: flex;
  flex-direction: column;
}
.page-card {
  flex: 1;
  overflow: hidden;
  flex-shrink: 0;
  background: #ffffff;
  box-shadow: 0px 2px 5px 0px rgba(0, 0, 0, 0.15);
  border-radius: 10px;
  padding: 30px;
  padding-top: 10px;
  position: relative;
}
.page-back {
  position: absolute;
  top: 20px;
  right: 20px;
  font-size: 16px;
  color: #666666;
  display: flex;
  align-items: center;
  cursor: pointer;
  &:hover {
    color: #4f7eff;
  }
  .img {
    height: 16px;
    margin-right: 6px;
  }
}
.page-title {
  font-weight: bold;
  font-size: 40px;
  color: #333333;
}
.page-navbar {
  margin-top: 20px;
  margin-bottom: 30px;
  display: flex;
  align-items: center;
  background: #fafafa;
  padding: 10px 20px;
}

.page-search {
  margin-bottom: 20px;
}

.default-title {
  font-size: 20px;
  color: #333333;
  line-height: 23px;
  margin-bottom: 20px;
  font-weight: bold;
}

.kernel-source {
  position: relative;
  margin-bottom: 40px;
  .bar-title {
    width: 100%;
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-left: 70px;
    .title {
      font-size: 20px;
      color: #333333;
      line-height: 23px;
      margin-bottom: 4px;
      font-weight: bold;
    }
    .subtitle {
      font-size: 14px;
      color: #666666;
      line-height: 19px;
    }
  }
  .bar-group {
    padding-left: 70px;
    display: flex;
    flex-direction: column;
    .bar-item {
      display: flex;
      align-items: center;
      .bar-label {
        width: 200px;
        font-weight: bold;
        font-size: 16px;
        color: #6b410d;
        line-height: 21px;
        &.open-source {
          color: #1ad300;
        }
      }
    }
  }
}

.time {
  .time-legend {
    padding-left: 20px;
    display: flex;
    gap: 10px;
    margin-bottom: 10px;
    .legend-item {
      width: 20px;
      height: 20px;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
      }
    }
  }
  .time-tips {
    padding-left: 20px;
    color: #f56c6c;
    margin-bottom: 10px;
  }
  .time-table {
    .table-scrollbar {
      ::v-deep(.el-scrollbar__thumb) {
        opacity: 0.6;
      }
    }

    .table-wrapper {
      .data-table {
        width: max-content;
        min-width: 100%;
        border-collapse: collapse;
        font-size: 14px;

        th,
        td {
          padding: 8px 12px;
          text-align: center;
          min-width: 120px;
        }

        thead {
          th {
            background: #ffffff;
            font-weight: bold;
            font-size: 16px;
            color: #333333;
            position: sticky;
            top: 0;
            z-index: 2;
            word-wrap: break-word;
            word-break: break-all;
          }
          .mat-header {
            background: #ffffff;
            border: none;
            width: 150px;
            min-width: 150px;
            max-width: 150px;
          }
          .kernel-header {
            width: 150px;
            min-width: 150px;
            max-width: 150px;
          }
        }

        tbody {
          .mat-cell {
            width: 150px;
            min-width: 150px;
            max-width: 150px;
            background: #ffffff;
            text-align: right;
            font-size: 16px;
            color: #666666;
            word-wrap: break-word;
            word-break: break-all;
          }
          .data-cell {
            width: 150px;
            min-width: 150px;
            max-width: 150px;
            font-size: 14px;
            color: #444444;
            word-wrap: break-word;
            word-break: break-all;
          }
        }

        .sticky-cell {
          position: sticky;
          left: 0;
          z-index: 1;
        }

        thead .sticky-cell {
          z-index: 3;
        }
      }
    }
  }
}

.nothing-selected {
  font-size: 32px;
  text-align: center;
  color: #cccccc;
}

::v-deep(.el-radio-group) {
  gap: 10px;
  .el-radio {
    margin-right: 0;
    font-weight: normal;
    font-size: 14px;
    background: #fafafa;
    border: none;
  }
  .el-radio__input {
    display: none;
  }
  .el-radio.is-bordered.is-checked {
    background: #ebf7ff;
    color: #0a55d5;
  }
}
</style>
