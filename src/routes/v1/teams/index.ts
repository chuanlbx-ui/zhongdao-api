/**
 * Team management API routes
 */

import { Router } from 'express';
import { asyncHandler } from "@/shared/middleware/asyncHandler";
import { authenticate } from "@/shared/middleware/auth";

const router = Router();

router.use(authenticate);

router.get("/structure", asyncHandler(async (req: any, res) => {
  try {
    const userId = req.user.sub;
    const userLevel = req.user.level;

    const structure = [{
      id: userId,
      nickname: "Test User",
      level: userLevel,
      children: []
    }];

    res.json({
      success: true,
      data: { structure, userLevel, totalMembers: structure.length },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: "TEAM_STRUCTURE_ERROR", message: "Failed to get team structure" },
      timestamp: new Date().toISOString()
    });
  }
}));

router.get("/performance", asyncHandler(async (req: any, res) => {
  try {
    const { period = "month" } = req.query;
    const performance = { totalSales: 10000, totalOrders: 50, totalMembers: 10, period };

    res.json({
      success: true,
      data: { performance, period },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: "TEAM_PERFORMANCE_ERROR", message: "Failed to get team performance" },
      timestamp: new Date().toISOString()
    });
  }
}));

router.post("/invite", asyncHandler(async (req: any, res) => {
  try {
    const inviterId = req.user.sub;
    const inviterLevel = req.user.level;
    const { phone, level = "NORMAL" } = req.body;

    if (!["STAR_1", "STAR_2", "STAR_3", "STAR_4", "STAR_5", "DIRECTOR"].includes(inviterLevel)) {
      return res.status(403).json({
        success: false,
        error: { code: "INSUFFICIENT_PERMISSION", message: "No permission to invite" },
        timestamp: new Date().toISOString()
      });
    }

    const result = { inviteId: "invite_" + Date.now(), phone, level, status: "PENDING" };

    res.json({
      success: true,
      data: result,
      message: "Invitation successful",
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: "INVITE_ERROR", message: error.message || "Invitation failed" },
      timestamp: new Date().toISOString()
    });
  }
}));

router.get("/members", asyncHandler(async (req: any, res) => {
  try {
    const { page = 1, perPage = 10 } = req.query;
    const members = [{ id: "member_1", nickname: "Test Member", level: "NORMAL", phone: "18800000001" }];
    
    const result = {
      items: members,
      total: members.length,
      page: parseInt(page as string),
      perPage: parseInt(perPage as string)
    };

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: "TEAM_MEMBERS_ERROR", message: "Failed to get team members" },
      timestamp: new Date().toISOString()
    });
  }
}));

router.put("/members/:userId/level", asyncHandler(async (req: any, res) => {
  try {
    const operatorRole = req.user.role;
    const { userId } = req.params;
    const { level } = req.body;

    if (operatorRole !== "ADMIN") {
      return res.status(403).json({
        success: false,
        error: { code: "INSUFFICIENT_PERMISSION", message: "No permission to adjust level" },
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: { userId, newLevel: level },
      message: "Level adjusted successfully",
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: "ADJUST_LEVEL_ERROR", message: "Level adjustment failed" },
      timestamp: new Date().toISOString()
    });
  }
}));

router.get("/statistics", asyncHandler(async (req: any, res) => {
  try {
    const { period = "month" } = req.query;
    const statistics = { totalMembers: 10, activeMembers: 8, totalSales: 10000, totalCommission: 1000, period };

    res.json({
      success: true,
      data: statistics,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: "TEAM_STATISTICS_ERROR", message: "Failed to get team statistics" },
      timestamp: new Date().toISOString()
    });
  }
}));

router.post("/:userId/move", asyncHandler(async (req: any, res) => {
  try {
    const operatorRole = req.user.role;
    const { userId } = req.params;
    const { newParentId } = req.body;

    if (operatorRole !== "ADMIN") {
      return res.status(403).json({
        success: false,
        error: { code: "INSUFFICIENT_PERMISSION", message: "No permission to move members" },
        timestamp: new Date().toISOString()
      });
    }

    const result = { userId, newParentId, movedBy: req.user.sub, movedAt: new Date().toISOString() };

    res.json({
      success: true,
      data: result,
      message: "Member moved successfully",
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: "MOVE_MEMBER_ERROR", message: error.message || "Move failed" },
      timestamp: new Date().toISOString()
    });
  }
}));

export default router;
