import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('托管签到系统端到端测试', () => {
  
  test('教师登录 - 创建班级 - 学生签到 - 历史考勤查询 完整用户旅程', async ({ page }) => {
      // 1. 访问登录页面
      await page.goto('/login');
      await expect(page).toHaveTitle('签到系统');
      await page.screenshot({ path: 'test-results/login-load.png' });

      // 2. 输入账号密码并登录
      await page.fill('#username', 'admin');
      await page.fill('#password', '123456');
      await page.screenshot({ path: 'test-results/login-filled.png' });
      
      await page.click('button[type="submit"]', { force: true });
      await page.screenshot({ path: 'test-results/login-clicked.png' });

      // 3. 验证登录成功后跳转到班级列表页
      await page.waitForURL('**/classes');
      await page.screenshot({ path: 'test-results/classes-loaded.png' });
      await expect(page.locator('h2')).toHaveText('班级列表');
      await expect(page.locator('.teacher-name')).toHaveText('张老师 老师');

    // 4. 新建班级（拉起底部抽屉并上传 Excel 文件）
    // 点击右上角的 "+" 按钮
    await page.click('.add-btn');
    
    // 验证新建班级抽屉已拉起
    await expect(page.locator('.drawer-title')).toHaveText('新建班级');

    // 输入班级名称
    const testClassName = `测试班级_${Date.now()}`;
    await page.fill('.drawer-input-group input[type="text"]', testClassName);

    // 上传测试学生花名册 Excel
    const excelPath = path.join(process.cwd(), 'tests/fixtures/students.xlsx');
    await page.setInputFiles('input[type="file"]', excelPath);

    // 验证文件上传成功（展现出文件名）
    await expect(page.locator('.file-name')).toHaveText('students.xlsx');

    // 点击“完成”创建班级
    await page.click('button.drawer-text-btn.confirm');

    // 验证抽屉关闭，且新班级卡片已存在于列表中
    await page.waitForSelector(`.class-card:has-text("${testClassName}")`);
    const classCard = page.locator(`.class-card:has-text("${testClassName}")`);
    await expect(classCard).toBeVisible();
    await expect(classCard.locator('.student-count')).toHaveText('3 名学生');

    // 5. 点击进入班级工作台
    await classCard.click();
    // 验证 loading 遮罩立刻显现
    await expect(page.locator('.full-page-loading')).toBeVisible();
    await expect(page.locator('.full-page-loading p')).toHaveText('正在载入班级...');
    await page.waitForURL(/\/class\/c_[a-f0-9]+/);
    await expect(page.locator('.class-name')).toHaveText(testClassName);
    await expect(page.locator('.student-meta')).toContainText('学生总数: 3 名');

    // 6. 点击签到按钮
    await page.click('button:has-text("签到")');
    await page.waitForURL(/\/class\/c_[a-f0-9]+\/checkin/);

    // ====================================================
    // 6.1 织入自定义确认对话框 (ConfirmDialog) 交互验证
    // ====================================================
    const workbenchUrl = page.url().replace(/\/checkin$/, '');
    const overlay = page.locator('.confirm-modal-overlay');

    // 点击返回按钮，拉起自定义确认弹窗
    await page.click('.back-btn');
    await expect(overlay).toHaveClass(/open/);
    await expect(page.locator('#confirm-dialog-title')).toHaveText('确认退出');
    await expect(page.locator('#confirm-dialog-message')).toHaveText('确定要退出签到吗？当前进度不会保存。');

    // 测试取消按钮点击
    await page.click('#confirm-dialog-cancel-btn');
    await expect(overlay).not.toHaveClass(/open/);
    expect(page.url()).toContain('/checkin'); // 仍在签到页

    // 测试按 Escape 键取消弹窗
    await page.click('.back-btn');
    await expect(overlay).toHaveClass(/open/);
    await page.keyboard.press('Escape');
    await expect(overlay).not.toHaveClass(/open/);

    // 测试点击遮罩层 (Overlay) 触发取消
    await page.click('.back-btn');
    await expect(overlay).toHaveClass(/open/);
    await overlay.click({ position: { x: 5, y: 5 } });
    await expect(overlay).not.toHaveClass(/open/);

    // 测试确定按钮点击退出跳转
    await page.click('.back-btn');
    await expect(overlay).toHaveClass(/open/);
    await page.click('#confirm-dialog-confirm-btn');
    
    // 验证弹窗关闭并成功返回工作台
    await page.waitForURL(workbenchUrl);
    expect(page.url()).toBe(workbenchUrl);

    // 重新点击“签到”按钮，再次进入签到页面以继续打卡
    await page.click('button:has-text("签到")');
    await page.waitForURL(/\/class\/c_[a-f0-9]+\/checkin/);
    // ====================================================
    // ConfirmDialog 交互验证结束，继续签到提交
    // ====================================================

    // 第一位学生：学生甲 -> 出勤 (是)
    await expect(page.locator('.student-seq')).toHaveText('序号 1');
    await expect(page.locator('.student-name')).toHaveText('学生甲');
    await page.click('.present-btn');

    // 第二位学生：学生乙 -> 出勤 (是)
    await expect(page.locator('.student-seq')).toHaveText('序号 2');
    await expect(page.locator('.student-name')).toHaveText('学生乙');
    await page.click('.present-btn');

    // 第三位学生：学生丙 -> 缺勤 (否)
    await expect(page.locator('.student-seq')).toHaveText('序号 3');
    await expect(page.locator('.student-name')).toHaveText('学生丙');
    await page.click('.absent-btn');

    // 3位学生考勤完毕后，会自动拉起二次确认抽屉
    const confirmDrawer = page.locator('.drawer-container');
    await expect(confirmDrawer).toHaveClass(/open/);
    await expect(page.locator('.drawer-title')).toContainText('确认');

    // 检查汇总统计数：应到 3，实到 2，缺勤 1
    await expect(confirmDrawer.locator('.stat-card.total .stat-num')).toHaveText('3');
    await expect(confirmDrawer.locator('.stat-card.present .stat-num')).toHaveText('2');
    await expect(confirmDrawer.locator('.stat-card.absent .stat-num')).toHaveText('1');

    // 点击“确认提交”
    await page.click('button:has-text("确认提交")');

    // 确认后应该跳回工作台
    await page.waitForURL(/\/class\/c_[a-f0-9]+/);

    // 7. 进入查询页面
    await page.click('button:has-text("查询")');
    await page.waitForURL(/\/class\/c_[a-f0-9]+\/query/);
    await expect(page.locator('.summary-info h2')).toHaveText(testClassName);

    // 点击“查询”以获取当前日期段的数据
    await page.click('button:has-text("查询")');

    // 验证表格内包含正确的学生统计数据
    const table = page.locator('.report-table');
    await expect(table.locator('tbody tr:nth-child(1) td.col-name')).toHaveText('学生甲');
    await expect(table.locator('tbody tr:nth-child(1) td.col-total')).toHaveText('1天');

    await expect(table.locator('tbody tr:nth-child(2) td.col-name')).toHaveText('学生乙');
    await expect(table.locator('tbody tr:nth-child(2) td.col-total')).toHaveText('1天');

    await expect(table.locator('tbody tr:nth-child(3) td.col-name')).toHaveText('学生丙');
    await expect(table.locator('tbody tr:nth-child(3) td.col-total')).toHaveText('0天');

    // 点击学生甲的详情，拉起个人打卡清单
    await table.locator('tbody tr:nth-child(1) button:has-text("详情")').click();

    // 验证明细弹窗拉起
    const detailDrawer = page.locator('.drawer-container');
    await expect(detailDrawer).toHaveClass(/open/);
    await expect(detailDrawer.locator('.drawer-title')).toHaveText('学生甲 的托管明细');

    // 确认清单内包含一条已托管的打卡记录
    await expect(detailDrawer.locator('.detail-item .detail-status')).toContainText('已托管');

    // 点击关闭按钮
    await detailDrawer.locator('.drawer-close-btn').click();
    await expect(detailDrawer).not.toHaveClass(/open/);
  });
});
