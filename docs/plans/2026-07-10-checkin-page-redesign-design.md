# 签到页面平铺式改版设计文档

## 1. 需求背景
原“签到”页面采用卡片轮播引导式的签到交互（一次显示一位学生，依次点击“出勤”或“缺勤”切换下一位，最后弹窗确认）。这在学生人数较多时操作过于繁琐，且缺乏直观的全览视图。

为了提高教师的签到效率，现将页面改版为“学生姓名按钮平铺 + 一键提交”的形式，支持全选/反选、可视化统计以及直接二次确认提交。

## 2. 交互设计与界面排布
- **顶部日期选择区**：保持不变，支持更改签到日期。
- **全局控制区**：在学生列表顶部，提供【全选】与【反选】两个操作按钮。
  - 【全选】：将所有学生状态设为“已签到”。
  - 【反选】：对所有学生的当前状态进行翻转。
- **学生列表平铺区**：
  - 采用多列 Grid 网格布局平铺展现所有学生。
  - 每个学生呈方框按钮状态，显示 `[序号] [姓名]`。
  - **点击行为**：点击某个学生，在“已签到”和“未签到”状态之间切换。
  - **状态视觉**：
    - 已签到：绿色背景，文字呈白色，方框内右侧显示勾选（Check）图标。
    - 未签到：默认浅色半透明背景，无勾选图标。默认状态下，所有学生初始化为未签到。
- **悬浮固定底部统计栏 (Sticky Bottom Bar)**：
  - 固定定位在视口最下方（`position: fixed`），带有磨砂毛玻璃和投影效果。
  - 左侧展示签到与未签到的实时统计：`已签到: X | 未签到: Y`。
  - 右侧/下方放置【确认提交】按钮。
- **提交确认弹窗**：
  - 点击底部的【确认提交】按钮，直接拉起一个项目已有的自定义 `ConfirmDialog` 弹窗（“确定要提交签到数据吗？”）。
  - 确认后直接向后台 API 发送请求并跳回工作台，不再显示原先的半屏抽屉确认步骤。

## 3. 技术方案
在 `src/app/class/[id]/checkin/page.js` 中重构状态与 JSX：
1. 声明 `isSubmitConfirmOpen` 控制提交弹窗。
2. 更改 `fetchClassData` 后的初始化逻辑，直接构造 `status: false` 的对象数组：
   ```javascript
   const initialRecords = sortedStudents.map(student => ({
     studentId: student.id,
     name: student.name,
     seqNum: student.seqNum,
     status: false
   }));
   setAttendanceRecords(initialRecords);
   ```
3. 实现 `handleSelectAll` 和 `handleInvertSelection`：
   ```javascript
   const handleSelectAll = () => {
     setAttendanceRecords(prev => prev.map(r => ({ ...r, status: true })));
   };
   const handleInvertSelection = () => {
     setAttendanceRecords(prev => prev.map(r => ({ ...r, status: !r.status })));
   };
   ```
4. 点击学生卡片时，触发状态翻转：
   ```javascript
   const toggleStudentStatus = (studentId) => {
     setAttendanceRecords(prev => prev.map(r => r.studentId === studentId ? { ...r, status: !r.status } : r));
   };
   ```
5. 底部渲染 Sticky 统计栏，并直接绑定提交弹窗。
6. 修改 `checkin.css`，引入 `.student-grid`、`.student-btn-card`、`.sticky-bottom-bar`。
