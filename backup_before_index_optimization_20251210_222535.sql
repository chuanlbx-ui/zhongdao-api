-- MySQL dump 10.13  Distrib 8.0.44, for Linux (x86_64)
--
-- Host: localhost    Database: zhongdao_mall_dev
-- ------------------------------------------------------
-- Server version	8.0.44

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `admins`
--

DROP TABLE IF EXISTS `admins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admins` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `username` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `realName` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `avatar` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` enum('SUPER_ADMIN','ADMIN','OPERATOR') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ADMIN',
  `status` enum('ACTIVE','INACTIVE','LOCKED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `lastLoginAt` datetime(3) DEFAULT NULL,
  `lastLoginIp` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `permissions` json DEFAULT NULL,
  `loginAttempts` int NOT NULL DEFAULT '0',
  `lockedUntil` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `admins_username_key` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admins`
--

LOCK TABLES `admins` WRITE;
/*!40000 ALTER TABLE `admins` DISABLE KEYS */;
/*!40000 ALTER TABLE `admins` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auditLogs`
--

DROP TABLE IF EXISTS `auditLogs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auditLogs` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `adminId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `adminName` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type` enum('LOGIN','LOGOUT','CREATE','UPDATE','DELETE','VIEW','EXPORT','APPROVE','REJECT','SUSPEND','ACTIVATE','RESET_PASSWORD','CHANGE_ROLE','SENSITIVE_OPERATION','SYSTEM_CONFIG','DATA_IMPORT','BULK_OPERATION') COLLATE utf8mb4_unicode_ci NOT NULL,
  `level` enum('INFO','WARNING','ERROR','CRITICAL') COLLATE utf8mb4_unicode_ci NOT NULL,
  `module` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `targetId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `targetType` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `details` text COLLATE utf8mb4_unicode_ci,
  `ipAddress` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `userAgent` text COLLATE utf8mb4_unicode_ci,
  `result` enum('SUCCESS','FAILED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'SUCCESS',
  `errorMessage` text COLLATE utf8mb4_unicode_ci,
  `duration` int DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `auditLogs_adminId_createdAt_idx` (`adminId`,`createdAt`),
  KEY `auditLogs_module_action_idx` (`module`,`action`),
  KEY `auditLogs_type_createdAt_idx` (`type`,`createdAt`),
  KEY `auditLogs_level_createdAt_idx` (`level`,`createdAt`),
  KEY `auditLogs_targetId_targetType_idx` (`targetId`,`targetType`),
  KEY `auditLogs_createdAt_idx` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auditLogs`
--

LOCK TABLES `auditLogs` WRITE;
/*!40000 ALTER TABLE `auditLogs` DISABLE KEYS */;
/*!40000 ALTER TABLE `auditLogs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `commissionCalculations`
--

DROP TABLE IF EXISTS `commissionCalculations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `commissionCalculations` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `period` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `totalCommission` double NOT NULL DEFAULT '0',
  `personalCommission` double NOT NULL DEFAULT '0',
  `teamCommission` double NOT NULL DEFAULT '0',
  `referralCommission` double NOT NULL DEFAULT '0',
  `bonusCommission` double NOT NULL DEFAULT '0',
  `status` enum('PENDING','CALCULATED','APPROVED','PAID','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `paidDate` datetime(3) DEFAULT NULL,
  `calculatedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `commissionCalculations_calculatedAt_idx` (`calculatedAt`),
  KEY `commissionCalculations_period_idx` (`period`),
  KEY `commissionCalculations_status_idx` (`status`),
  KEY `commissionCalculationsUserIdFkey` (`userId`),
  KEY `commissionCalculationsUserPeriodIdx` (`userId`,`period`),
  CONSTRAINT `commissionCalculations_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `commissionCalculations`
--

LOCK TABLES `commissionCalculations` WRITE;
/*!40000 ALTER TABLE `commissionCalculations` DISABLE KEYS */;
/*!40000 ALTER TABLE `commissionCalculations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `configChangeHistory`
--

DROP TABLE IF EXISTS `configChangeHistory`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `configChangeHistory` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `configId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `configKey` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `oldValue` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `newValue` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `changedBy` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `changeReason` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `configChangeHistory_configId_idx` (`configId`),
  KEY `configChangeHistory_configKey_idx` (`configKey`),
  KEY `configChangeHistory_changedBy_idx` (`changedBy`),
  KEY `configChangeHistory_createdAt_idx` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `configChangeHistory`
--

LOCK TABLES `configChangeHistory` WRITE;
/*!40000 ALTER TABLE `configChangeHistory` DISABLE KEYS */;
/*!40000 ALTER TABLE `configChangeHistory` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `giftRecords`
--

DROP TABLE IF EXISTS `giftRecords`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `giftRecords` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `orderId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `productId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` int NOT NULL,
  `value` double NOT NULL,
  `type` enum('BUY_TEN_GET_ONE','PROMOTION_GIFT','VIP_GIFT','WUTONG_BUY_TEN_GET_ONE','REWARD_GIFT','COMPENSATION_GIFT') COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('PENDING','PROCESSING','SHIPPED','COMPLETED','CANCELLED','EXPIRED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `metadata` json DEFAULT NULL,
  `remarks` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `shippedAt` datetime(3) DEFAULT NULL,
  `completedAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `giftRecordsOrderIdFkey` (`orderId`),
  KEY `giftRecordsProductIdFkey` (`productId`),
  KEY `giftRecordsUserIdFkey` (`userId`),
  CONSTRAINT `giftRecords_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `giftRecords_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `giftRecords_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `giftRecords`
--

LOCK TABLES `giftRecords` WRITE;
/*!40000 ALTER TABLE `giftRecords` DISABLE KEYS */;
/*!40000 ALTER TABLE `giftRecords` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventoryAlerts`
--

DROP TABLE IF EXISTS `inventoryAlerts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventoryAlerts` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `productId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `specId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `shopId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `alertType` enum('LOW_STOCK','OUT_OF_STOCK','EXCESS_STOCK','EXPIRED') COLLATE utf8mb4_unicode_ci NOT NULL,
  `currentQuantity` int NOT NULL,
  `threshold` int NOT NULL,
  `warehouseType` enum('PLATFORM','CLOUD','LOCAL') COLLATE utf8mb4_unicode_ci NOT NULL,
  `isRead` tinyint(1) NOT NULL DEFAULT '0',
  `isResolved` tinyint(1) NOT NULL DEFAULT '0',
  `resolvedAt` datetime(3) DEFAULT NULL,
  `resolvedBy` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `resolveNote` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notificationSent` tinyint(1) NOT NULL DEFAULT '0',
  `lastNotifiedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `inventoryAlertsProductIdFkey` (`productId`),
  KEY `inventoryAlertsResolvedByFkey` (`resolvedBy`),
  KEY `inventoryAlertsShopIdFkey` (`shopId`),
  KEY `inventoryAlertsSpecIdFkey` (`specId`),
  KEY `inventoryAlertsUserIdFkey` (`userId`),
  CONSTRAINT `inventoryAlerts_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventoryAlerts_resolvedBy_fkey` FOREIGN KEY (`resolvedBy`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventoryAlerts_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shops` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventoryAlerts_specId_fkey` FOREIGN KEY (`specId`) REFERENCES `productSpecs` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventoryAlerts_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventoryAlerts`
--

LOCK TABLES `inventoryAlerts` WRITE;
/*!40000 ALTER TABLE `inventoryAlerts` DISABLE KEYS */;
/*!40000 ALTER TABLE `inventoryAlerts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventoryItems`
--

DROP TABLE IF EXISTS `inventoryItems`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventoryItems` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `productId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `specId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `shopId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `warehouseType` enum('PLATFORM','CLOUD','LOCAL') COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` int NOT NULL DEFAULT '0',
  `frozenQuantity` int NOT NULL DEFAULT '0',
  `minStock` int NOT NULL DEFAULT '10',
  `lastInAt` datetime(3) DEFAULT NULL,
  `lastOutAt` datetime(3) DEFAULT NULL,
  `lastAlertAt` datetime(3) DEFAULT NULL,
  `alertCount` int NOT NULL DEFAULT '0',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `inventoryItems_userId_productId_specId_warehouseType_key` (`userId`,`productId`,`specId`,`warehouseType`),
  KEY `inventoryItemsProductIdFkey` (`productId`),
  KEY `inventoryItemsShopIdFkey` (`shopId`),
  KEY `inventoryItemsSpecIdFkey` (`specId`),
  CONSTRAINT `inventoryItems_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventoryItems_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shops` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventoryItems_specId_fkey` FOREIGN KEY (`specId`) REFERENCES `productSpecs` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventoryItems_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventoryItems`
--

LOCK TABLES `inventoryItems` WRITE;
/*!40000 ALTER TABLE `inventoryItems` DISABLE KEYS */;
/*!40000 ALTER TABLE `inventoryItems` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventoryLogs`
--

DROP TABLE IF EXISTS `inventoryLogs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventoryLogs` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `productId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `specId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `shopId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `operationType` enum('MANUAL_IN','MANUAL_OUT','ORDER_OUT','PURCHASE_IN','ADJUSTMENT','TRANSFER_IN','TRANSFER_OUT','RETURN_IN','DAMAGE_OUT','INITIAL') COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` int NOT NULL,
  `quantityBefore` int NOT NULL,
  `quantityAfter` int NOT NULL,
  `warehouseType` enum('PLATFORM','CLOUD','LOCAL') COLLATE utf8mb4_unicode_ci NOT NULL,
  `relatedOrderId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `relatedPurchaseId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `adjustmentReason` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `operatorId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `operatorType` enum('SYSTEM','ADMIN','USER','SYSTEM_BATCH') COLLATE utf8mb4_unicode_ci NOT NULL,
  `remarks` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `inventoryLogs_createdAt_idx` (`createdAt`),
  KEY `inventoryLogsDateUserIdx` (`createdAt`,`userId`),
  KEY `inventoryLogsOperatorIdFkey` (`operatorId`),
  KEY `inventoryLogsProductIdFkey` (`productId`),
  KEY `inventoryLogsShopIdFkey` (`shopId`),
  KEY `inventoryLogsSpecIdFkey` (`specId`),
  KEY `inventoryLogsUserIdFkey` (`userId`),
  KEY `inventoryLogsUserWarehouseIdx` (`userId`,`warehouseType`),
  CONSTRAINT `inventoryLogs_operatorId_fkey` FOREIGN KEY (`operatorId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventoryLogs_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventoryLogs_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shops` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventoryLogs_specId_fkey` FOREIGN KEY (`specId`) REFERENCES `productSpecs` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventoryLogs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventoryLogs`
--

LOCK TABLES `inventoryLogs` WRITE;
/*!40000 ALTER TABLE `inventoryLogs` DISABLE KEYS */;
/*!40000 ALTER TABLE `inventoryLogs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventoryStocks`
--

DROP TABLE IF EXISTS `inventoryStocks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventoryStocks` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `productId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `specId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `warehouseType` enum('PLATFORM','CLOUD','LOCAL') COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `shopId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity` int NOT NULL DEFAULT '0',
  `reservedQuantity` int NOT NULL DEFAULT '0',
  `availableQuantity` int NOT NULL DEFAULT '0',
  `batchNumber` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `location` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expiryDate` datetime(3) DEFAULT NULL,
  `cost` double NOT NULL DEFAULT '0',
  `salePrice` double NOT NULL DEFAULT '0',
  `turnoverRate` double NOT NULL DEFAULT '0',
  `outOfStockCount` int NOT NULL DEFAULT '0',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `inventoryStocks_productId_idx` (`productId`),
  KEY `inventoryStocks_shopId_idx` (`shopId`),
  KEY `inventoryStocksSpecIdFkey` (`specId`),
  KEY `inventoryStocks_userId_idx` (`userId`),
  KEY `inventoryStocks_warehouseType_idx` (`warehouseType`),
  CONSTRAINT `inventoryStocks_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `inventoryStocks_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shops` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventoryStocks_specId_fkey` FOREIGN KEY (`specId`) REFERENCES `productSpecs` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventoryStocks_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventoryStocks`
--

LOCK TABLES `inventoryStocks` WRITE;
/*!40000 ALTER TABLE `inventoryStocks` DISABLE KEYS */;
/*!40000 ALTER TABLE `inventoryStocks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `levelUpgradeRecords`
--

DROP TABLE IF EXISTS `levelUpgradeRecords`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `levelUpgradeRecords` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `previousLevel` enum('NORMAL','VIP','STAR_1','STAR_2','STAR_3','STAR_4','STAR_5','DIRECTOR') COLLATE utf8mb4_unicode_ci NOT NULL,
  `newLevel` enum('NORMAL','VIP','STAR_1','STAR_2','STAR_3','STAR_4','STAR_5','DIRECTOR') COLLATE utf8mb4_unicode_ci NOT NULL,
  `upgradeType` enum('AUTO','MANUAL','WUTONG_PRIVILEGE','TEAM_ACHIEVEMENT','SPECIAL_PROMOTION') COLLATE utf8mb4_unicode_ci NOT NULL,
  `approvedById` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `approvedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `remarks` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stats` json DEFAULT NULL,
  `requirements` json DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `levelUpgradeRecordsUserIdFkey` (`userId`),
  CONSTRAINT `levelUpgradeRecords_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `levelUpgradeRecords`
--

LOCK TABLES `levelUpgradeRecords` WRITE;
/*!40000 ALTER TABLE `levelUpgradeRecords` DISABLE KEYS */;
/*!40000 ALTER TABLE `levelUpgradeRecords` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `logisticsCompanies`
--

DROP TABLE IF EXISTS `logisticsCompanies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `logisticsCompanies` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `displayName` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `logo` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `website` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `serviceScope` enum('NATIONAL','INTERNATIONAL','LOCAL','SAME_CITY') COLLATE utf8mb4_unicode_ci NOT NULL,
  `deliveryTypes` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `normalDelivery` int NOT NULL DEFAULT '48',
  `expressDelivery` int NOT NULL DEFAULT '24',
  `apiProvider` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `apiConfig` json DEFAULT NULL,
  `apiEnabled` tinyint(1) NOT NULL DEFAULT '0',
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `sort` int NOT NULL DEFAULT '0',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `logisticsCompanies_code_key` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `logisticsCompanies`
--

LOCK TABLES `logisticsCompanies` WRITE;
/*!40000 ALTER TABLE `logisticsCompanies` DISABLE KEYS */;
/*!40000 ALTER TABLE `logisticsCompanies` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `logisticsInfo`
--

DROP TABLE IF EXISTS `logisticsInfo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `logisticsInfo` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `orderId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expressCompany` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `trackingNumber` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('NOT_SHIPPED','SHIPPED','IN_TRANSIT','OUT_FOR_DELIVERY','DELIVERED','EXCEPTION') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'NOT_SHIPPED',
  `currentLocation` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `estimatedDeliveryDate` datetime(3) DEFAULT NULL,
  `tracks` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `metadata` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `logisticsInfo_orderId_key` (`orderId`),
  CONSTRAINT `logisticsInfo_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `logisticsInfo`
--

LOCK TABLES `logisticsInfo` WRITE;
/*!40000 ALTER TABLE `logisticsInfo` DISABLE KEYS */;
/*!40000 ALTER TABLE `logisticsInfo` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `logisticsShipments`
--

DROP TABLE IF EXISTS `logisticsShipments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `logisticsShipments` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `shipmentNo` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `orderId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `trackingNumber` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expressType` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `senderName` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `senderPhone` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `senderAddress` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `senderProvince` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `senderCity` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `senderDistrict` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `senderPostalCode` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `receiverName` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `receiverPhone` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `receiverAddress` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `receiverProvince` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `receiverCity` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `receiverDistrict` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `receiverPostalCode` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `packageCount` int NOT NULL DEFAULT '1',
  `packageWeight` double DEFAULT NULL,
  `packageVolume` double DEFAULT NULL,
  `packageDesc` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `goodsValue` double DEFAULT NULL,
  `deliveryType` enum('STANDARD','EXPRESS','SAME_DAY','NEXT_DAY','PICKUP') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'STANDARD',
  `deliveryFee` double NOT NULL DEFAULT '0',
  `codAmount` double DEFAULT NULL,
  `estimatedDelivery` datetime(3) DEFAULT NULL,
  `actualDelivery` datetime(3) DEFAULT NULL,
  `deliveryPhoto` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `deliverySignature` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('NOT_SHIPPED','SHIPPED','IN_TRANSIT','OUT_FOR_DELIVERY','DELIVERED','EXCEPTION') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'NOT_SHIPPED',
  `lastStatus` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lastLocation` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isException` tinyint(1) NOT NULL DEFAULT '0',
  `exceptionReason` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `exceptionTime` datetime(3) DEFAULT NULL,
  `resolvedAt` datetime(3) DEFAULT NULL,
  `apiSyncedAt` datetime(3) DEFAULT NULL,
  `syncStatus` enum('PENDING','SYNCING','SUCCESS','FAILED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `remarks` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `shippedAt` datetime(3) DEFAULT NULL,
  `completedAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `logisticsShipments_shipmentNo_key` (`shipmentNo`),
  KEY `logisticsShipmentsCompanyIdFkey` (`companyId`),
  KEY `logisticsShipmentsOrderIdFkey` (`orderId`),
  KEY `logisticsShipmentsUserIdFkey` (`userId`),
  CONSTRAINT `logisticsShipments_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `logisticsCompanies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `logisticsShipments_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `logisticsShipments_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `logisticsShipments`
--

LOCK TABLES `logisticsShipments` WRITE;
/*!40000 ALTER TABLE `logisticsShipments` DISABLE KEYS */;
/*!40000 ALTER TABLE `logisticsShipments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `logisticsTracks`
--

DROP TABLE IF EXISTS `logisticsTracks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `logisticsTracks` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `shipmentId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `time` datetime(3) NOT NULL,
  `status` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `location` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `operator` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `operatorPhone` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source` enum('MANUAL','API','WEBHOOK','IMPORT') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'MANUAL',
  `sourceCode` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `logisticsTracksShipmentIdFkey` (`shipmentId`),
  CONSTRAINT `logisticsTracks_shipmentId_fkey` FOREIGN KEY (`shipmentId`) REFERENCES `logisticsShipments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `logisticsTracks`
--

LOCK TABLES `logisticsTracks` WRITE;
/*!40000 ALTER TABLE `logisticsTracks` DISABLE KEYS */;
/*!40000 ALTER TABLE `logisticsTracks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notificationChannels`
--

DROP TABLE IF EXISTS `notificationChannels`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notificationChannels` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `channelType` enum('IN_APP','SMS','EMAIL','WECHAT_MINI','WECHAT_OFFICIAL','PUSH','WEBHOOK') COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `config` json NOT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `canRetry` tinyint(1) NOT NULL DEFAULT '1',
  `maxRetries` int NOT NULL DEFAULT '3',
  `timeoutSeconds` int NOT NULL DEFAULT '30',
  `dailyLimit` int DEFAULT NULL,
  `rateLimit` int DEFAULT NULL,
  `batchSize` int NOT NULL DEFAULT '100',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notificationChannels`
--

LOCK TABLES `notificationChannels` WRITE;
/*!40000 ALTER TABLE `notificationChannels` DISABLE KEYS */;
/*!40000 ALTER TABLE `notificationChannels` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notificationPreferences`
--

DROP TABLE IF EXISTS `notificationPreferences`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notificationPreferences` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `isEnabled` tinyint(1) NOT NULL DEFAULT '1',
  `quietHoursStart` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quietHoursEnd` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `channelPreferences` json NOT NULL,
  `categorySettings` json NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `notificationPreferences_userId_key` (`userId`),
  CONSTRAINT `notificationPreferences_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notificationPreferences`
--

LOCK TABLES `notificationPreferences` WRITE;
/*!40000 ALTER TABLE `notificationPreferences` DISABLE KEYS */;
/*!40000 ALTER TABLE `notificationPreferences` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `recipientId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `recipientType` enum('USER','ADMIN','SYSTEM','GROUP') COLLATE utf8mb4_unicode_ci NOT NULL,
  `templateId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `category` enum('SYSTEM','ORDER','PAYMENT','LOGISTICS','USER_LEVEL','SHOP','INVENTORY','PROMOTION','ANNOUNCEMENT','SECURITY','FINANCIAL','TEAM','ACTIVITY') COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('INFO','SUCCESS','WARNING','ERROR','REMINDER','PROMOTION','ANNOUNCEMENT','ALERT') COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `variables` json DEFAULT NULL,
  `channels` json NOT NULL,
  `sentChannels` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `failedChannels` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('PENDING','SENDING','SENT','PARTIAL_SUCCESS','FAILED','COMPLETED','CANCELLED','RETRYING') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `priority` enum('LOW','NORMAL','HIGH','URGENT') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'NORMAL',
  `isRead` tinyint(1) NOT NULL DEFAULT '0',
  `readAt` datetime(3) DEFAULT NULL,
  `sendResult` json DEFAULT NULL,
  `errorReason` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `retryCount` int NOT NULL DEFAULT '0',
  `maxRetries` int NOT NULL DEFAULT '3',
  `relatedType` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `relatedId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `businessData` json DEFAULT NULL,
  `scheduledAt` datetime(3) DEFAULT NULL,
  `sentAt` datetime(3) DEFAULT NULL,
  `completedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `notificationsRecipientIdFkey` (`recipientId`),
  KEY `notificationsTemplateIdFkey` (`templateId`),
  KEY `idx_notifications_recipient_id` (`recipientId`,`id`),
  KEY `idx_notifications_recipient_read` (`recipientId`,`isRead`),
  CONSTRAINT `notifications_recipientId_fkey` FOREIGN KEY (`recipientId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `notifications_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `notificationTemplates` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
INSERT INTO `notifications` VALUES ('test_notify_1764950453009_6zhppv','aiwlm3azfr6ryc2mx64mqo6b','USER',NULL,'SYSTEM','INFO','测试通知','这是一条测试通知',NULL,'{\"APP\": true}','APP',NULL,'SENT','NORMAL',0,NULL,NULL,NULL,0,3,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-05 16:00:53.010','2025-12-05 16:00:53.009'),('test_notify_1764950508343_1hyjqj','aiwlm3azfr6ryc2mx64mqo6b','USER',NULL,'SYSTEM','INFO','测试通知','这是一条测试通知',NULL,'{\"APP\": true}','APP',NULL,'SENT','NORMAL',0,NULL,NULL,NULL,0,3,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-05 16:01:48.344','2025-12-05 16:01:48.343'),('test_notify_1764950540651_2y5px','aiwlm3azfr6ryc2mx64mqo6b','USER',NULL,'SYSTEM','INFO','测试通知','这是一条测试通知',NULL,'{\"APP\": true}','APP',NULL,'SENT','NORMAL',0,NULL,NULL,NULL,0,3,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-05 16:02:20.652','2025-12-05 16:02:20.651'),('test_notify_1764950540706_v82ixd','aiwlm3azfr6ryc2mx64mqo6b','USER',NULL,'SYSTEM','INFO','测试通知','这是一条测试通知',NULL,'{\"APP\": true}','APP',NULL,'SENT','NORMAL',0,NULL,NULL,NULL,0,3,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-05 16:02:20.707','2025-12-05 16:02:20.706');
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notificationStatistics`
--

DROP TABLE IF EXISTS `notificationStatistics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notificationStatistics` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `date` datetime(3) NOT NULL,
  `category` enum('SYSTEM','ORDER','PAYMENT','LOGISTICS','USER_LEVEL','SHOP','INVENTORY','PROMOTION','ANNOUNCEMENT','SECURITY','FINANCIAL','TEAM','ACTIVITY') COLLATE utf8mb4_unicode_ci NOT NULL,
  `channelType` enum('IN_APP','SMS','EMAIL','WECHAT_MINI','WECHAT_OFFICIAL','PUSH','WEBHOOK') COLLATE utf8mb4_unicode_ci NOT NULL,
  `totalSent` int NOT NULL DEFAULT '0',
  `totalSuccess` int NOT NULL DEFAULT '0',
  `totalFailed` int NOT NULL DEFAULT '0',
  `successRate` double NOT NULL DEFAULT '0',
  `averageResponseTime` double DEFAULT NULL,
  `errorReasons` json DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `notificationStatistics_date_category_channelType_key` (`date`,`category`,`channelType`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notificationStatistics`
--

LOCK TABLES `notificationStatistics` WRITE;
/*!40000 ALTER TABLE `notificationStatistics` DISABLE KEYS */;
/*!40000 ALTER TABLE `notificationStatistics` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notificationTemplates`
--

DROP TABLE IF EXISTS `notificationTemplates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notificationTemplates` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` enum('SYSTEM','ORDER','PAYMENT','LOGISTICS','USER_LEVEL','SHOP','INVENTORY','PROMOTION','ANNOUNCEMENT','SECURITY','FINANCIAL','TEAM','ACTIVITY') COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `variables` json DEFAULT NULL,
  `enabledChannels` json NOT NULL,
  `defaultChannels` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `isSystem` tinyint(1) NOT NULL DEFAULT '0',
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `priority` enum('LOW','NORMAL','HIGH','URGENT') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'NORMAL',
  `dailyLimit` int DEFAULT NULL,
  `rateLimit` int DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `notificationTemplates_code_key` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notificationTemplates`
--

LOCK TABLES `notificationTemplates` WRITE;
/*!40000 ALTER TABLE `notificationTemplates` DISABLE KEYS */;
/*!40000 ALTER TABLE `notificationTemplates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `orderItems`
--

DROP TABLE IF EXISTS `orderItems`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `orderItems` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `orderId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `productId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `productName` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `productSpec` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `productImage` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity` int NOT NULL,
  `discountAmount` double NOT NULL DEFAULT '0',
  `finalPrice` double NOT NULL,
  `metadata` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `skuId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `totalPrice` double NOT NULL,
  `unitPrice` double NOT NULL,
  PRIMARY KEY (`id`),
  KEY `orderItemsOrderIdFkey` (`orderId`),
  KEY `orderItemsProductIdFkey` (`productId`),
  KEY `orderItemsSkuIdFkey` (`skuId`),
  CONSTRAINT `orderItems_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `orderItems_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `orderItems_skuId_fkey` FOREIGN KEY (`skuId`) REFERENCES `productSpecs` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `orderItems`
--

LOCK TABLES `orderItems` WRITE;
/*!40000 ALTER TABLE `orderItems` DISABLE KEYS */;
/*!40000 ALTER TABLE `orderItems` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `orders` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `orderNo` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `totalAmount` double NOT NULL,
  `discountAmount` double NOT NULL DEFAULT '0',
  `finalAmount` double NOT NULL,
  `status` enum('PENDING','PAID','PROCESSING','SHIPPED','DELIVERED','CANCELLED','REFUNDED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `paymentStatus` enum('UNPAID','PAYING','PAID','FAILED','REFUNDING','REFUNDED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'UNPAID',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `paidAt` datetime(3) DEFAULT NULL,
  `shippedAt` datetime(3) DEFAULT NULL,
  `deliveredAt` datetime(3) DEFAULT NULL,
  `buyerId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `buyerNotes` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cancelledAt` datetime(3) DEFAULT NULL,
  `cashAmount` double DEFAULT NULL,
  `completedAt` datetime(3) DEFAULT NULL,
  `metadata` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `paymentMethod` enum('WECHAT','ALIPAY','POINTS','MIXED') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pointsAmount` double DEFAULT NULL,
  `promotionInfo` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sellerId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sellerNotes` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `shippingAddress` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `shippingFee` double NOT NULL DEFAULT '0',
  `type` enum('RETAIL','PURCHASE','TEAM','EXCHANGE') COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `orders_orderNo_key` (`orderNo`),
  KEY `ordersBuyerIdFkey` (`buyerId`),
  KEY `ordersBuyerStatusIdx` (`buyerId`,`status`),
  KEY `orders_createdAt_idx` (`createdAt`),
  KEY `ordersPaymentStatusIdx` (`paymentStatus`),
  KEY `ordersSellerIdFkey` (`sellerId`),
  KEY `orders_status_idx` (`status`),
  CONSTRAINT `orders_buyerId_fkey` FOREIGN KEY (`buyerId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `orders_sellerId_fkey` FOREIGN KEY (`sellerId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `orders`
--

LOCK TABLES `orders` WRITE;
/*!40000 ALTER TABLE `orders` DISABLE KEYS */;
/*!40000 ALTER TABLE `orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paymentLocks`
--

DROP TABLE IF EXISTS `paymentLocks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paymentLocks` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `lockKey` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `orderId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` double NOT NULL,
  `expiresAt` datetime(3) NOT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `paymentLocks_lockKey_key` (`lockKey`),
  KEY `paymentLocks_expiresAt_idx` (`expiresAt`),
  KEY `paymentLocks_lockKey_idx` (`lockKey`),
  KEY `paymentLocks_orderId_idx` (`orderId`),
  KEY `paymentLocks_userId_idx` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paymentLocks`
--

LOCK TABLES `paymentLocks` WRITE;
/*!40000 ALTER TABLE `paymentLocks` DISABLE KEYS */;
/*!40000 ALTER TABLE `paymentLocks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paymentLogs`
--

DROP TABLE IF EXISTS `paymentLogs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paymentLogs` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `paymentId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action` enum('CREATE','QUERY','SUCCESS','FAILED','CANCEL','CLOSE','EXPIRE','NOTIFY','REFUND_CREATE','REFUND_SUCCESS','REFUND_FAILED') COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `beforeStatus` enum('UNPAID','PAYING','PAID','FAILED','REFUNDING','REFUNDED') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `afterStatus` enum('UNPAID','PAYING','PAID','FAILED','REFUNDING','REFUNDED') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `requestData` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `responseData` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `operatorId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `clientIp` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `userAgent` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `extra` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `paymentLogs_action_idx` (`action`),
  KEY `paymentLogs_createdAt_idx` (`createdAt`),
  KEY `paymentLogsOperatorIdFkey` (`operatorId`),
  KEY `paymentLogs_paymentId_idx` (`paymentId`),
  CONSTRAINT `paymentLogs_operatorId_fkey` FOREIGN KEY (`operatorId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `paymentLogs_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `paymentRecords` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paymentLogs`
--

LOCK TABLES `paymentLogs` WRITE;
/*!40000 ALTER TABLE `paymentLogs` DISABLE KEYS */;
/*!40000 ALTER TABLE `paymentLogs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paymentReconciliations`
--

DROP TABLE IF EXISTS `paymentReconciliations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paymentReconciliations` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reconcileNo` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reconcileDate` datetime(3) NOT NULL,
  `totalCount` int NOT NULL DEFAULT '0',
  `totalAmount` double NOT NULL DEFAULT '0',
  `successCount` int NOT NULL DEFAULT '0',
  `successAmount` double NOT NULL DEFAULT '0',
  `failedCount` int NOT NULL DEFAULT '0',
  `failedAmount` double NOT NULL DEFAULT '0',
  `status` enum('PENDING','PROCESSING','SUCCESS','FAILED','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `errorMessage` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `channelDataFile` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `systemDataFile` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reportFile` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `extra` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `completedAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `paymentReconciliations_reconcileNo_key` (`reconcileNo`),
  KEY `paymentReconciliations_reconcileDate_idx` (`reconcileDate`),
  KEY `paymentReconciliations_status_idx` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paymentReconciliations`
--

LOCK TABLES `paymentReconciliations` WRITE;
/*!40000 ALTER TABLE `paymentReconciliations` DISABLE KEYS */;
/*!40000 ALTER TABLE `paymentReconciliations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paymentRecords`
--

DROP TABLE IF EXISTS `paymentRecords`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paymentRecords` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `orderId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `paymentMethod` enum('WECHAT','ALIPAY','POINTS','MIXED') COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` double NOT NULL,
  `status` enum('UNPAID','PAYING','PAID','FAILED','REFUNDING','REFUNDED') COLLATE utf8mb4_unicode_ci NOT NULL,
  `paidAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `channelOrderId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `channelTransactionId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `clientIp` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `currency` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'CNY',
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expiredAt` datetime(3) DEFAULT NULL,
  `extra` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notifiedAt` datetime(3) DEFAULT NULL,
  `notifyData` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `paymentChannel` enum('WECHAT','ALIPAY','POINTS','MIXED') COLLATE utf8mb4_unicode_ci NOT NULL,
  `paymentNo` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `prepayId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `subject` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `userAgent` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `userId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `paymentRecords_paymentNo_key` (`paymentNo`),
  KEY `paymentRecords_channelOrderId_idx` (`channelOrderId`),
  KEY `paymentRecords_createdAt_idx` (`createdAt`),
  KEY `paymentRecords_orderId_idx` (`orderId`),
  KEY `paymentRecords_paymentChannel_idx` (`paymentChannel`),
  KEY `paymentRecords_status_idx` (`status`),
  KEY `paymentRecords_userId_idx` (`userId`),
  CONSTRAINT `paymentRecords_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `paymentRecords_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paymentRecords`
--

LOCK TABLES `paymentRecords` WRITE;
/*!40000 ALTER TABLE `paymentRecords` DISABLE KEYS */;
/*!40000 ALTER TABLE `paymentRecords` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paymentRefunds`
--

DROP TABLE IF EXISTS `paymentRefunds`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paymentRefunds` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `refundNo` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `paymentId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `refundAmount` double NOT NULL,
  `refundReason` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `applyUserId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `approveUserId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `channelRefundId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `channelTransactionId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('PENDING','PROCESSING','SUCCESS','FAILED','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `refundedAt` datetime(3) DEFAULT NULL,
  `failedReason` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notifyData` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notifiedAt` datetime(3) DEFAULT NULL,
  `extra` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `paymentRefunds_refundNo_key` (`refundNo`),
  KEY `paymentRefunds_applyUserId_idx` (`applyUserId`),
  KEY `paymentRefundsApproveUserIdFkey` (`approveUserId`),
  KEY `paymentRefunds_paymentId_idx` (`paymentId`),
  KEY `paymentRefunds_status_idx` (`status`),
  CONSTRAINT `paymentRefunds_applyUserId_fkey` FOREIGN KEY (`applyUserId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `paymentRefunds_approveUserId_fkey` FOREIGN KEY (`approveUserId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `paymentRefunds_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `paymentRecords` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paymentRefunds`
--

LOCK TABLES `paymentRefunds` WRITE;
/*!40000 ALTER TABLE `paymentRefunds` DISABLE KEYS */;
/*!40000 ALTER TABLE `paymentRefunds` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `performanceMetrics`
--

DROP TABLE IF EXISTS `performanceMetrics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `performanceMetrics` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `period` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `personalSales` double NOT NULL DEFAULT '0',
  `personalOrders` int NOT NULL DEFAULT '0',
  `newCustomers` int NOT NULL DEFAULT '0',
  `repeatRate` double NOT NULL DEFAULT '0',
  `averageOrderValue` double NOT NULL DEFAULT '0',
  `teamSales` double NOT NULL DEFAULT '0',
  `teamOrders` int NOT NULL DEFAULT '0',
  `newMembers` int NOT NULL DEFAULT '0',
  `activeRate` double NOT NULL DEFAULT '0',
  `directReferrals` int NOT NULL DEFAULT '0',
  `referralRevenue` double NOT NULL DEFAULT '0',
  `currentRole` enum('MEMBER','CAPTAIN','MANAGER','DIRECTOR','SENIOR_DIRECTOR','PARTNER','AMBASSADOR') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'MEMBER',
  `progressPercentage` double NOT NULL DEFAULT '0',
  `requirementsMet` json DEFAULT NULL,
  `calculationDate` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `performanceMetrics_userId_period_key` (`userId`,`period`),
  CONSTRAINT `performanceMetrics_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `performanceMetrics`
--

LOCK TABLES `performanceMetrics` WRITE;
/*!40000 ALTER TABLE `performanceMetrics` DISABLE KEYS */;
/*!40000 ALTER TABLE `performanceMetrics` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pointsTransactions`
--

DROP TABLE IF EXISTS `pointsTransactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pointsTransactions` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `transactionNo` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fromUserId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `toUserId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` double NOT NULL,
  `type` enum('PURCHASE','TRANSFER','RECHARGE','WITHDRAW','REFUND','COMMISSION','REWARD','FREEZE','UNFREEZE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `relatedOrderId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `status` enum('PENDING','PROCESSING','COMPLETED','FAILED','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `balanceBefore` double NOT NULL,
  `balanceAfter` double NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `completedAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pointsTransactions_transactionNo_key` (`transactionNo`),
  KEY `pointsTransactionsFromUserIdFkey` (`fromUserId`),
  KEY `pointsTransactionsToUserIdFkey` (`toUserId`),
  KEY `idx_points_transactions_user` (`fromUserId`,`toUserId`),
  KEY `idx_points_transactions_from_time` (`fromUserId`,`createdAt`),
  KEY `idx_points_transactions_to_time` (`toUserId`,`createdAt`),
  KEY `idx_points_transactions_type_time` (`type`,`createdAt`),
  KEY `idx_points_transactions_status_time` (`status`,`createdAt`),
  CONSTRAINT `pointsTransactions_fromUserId_fkey` FOREIGN KEY (`fromUserId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `pointsTransactions_toUserId_fkey` FOREIGN KEY (`toUserId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pointsTransactions`
--

LOCK TABLES `pointsTransactions` WRITE;
/*!40000 ALTER TABLE `pointsTransactions` DISABLE KEYS */;
INSERT INTO `pointsTransactions` VALUES ('1802185aac0c7268ffe3ab8a','PT1765209968771TEST','aiwlm3azfr6ryc2mx64mqo6b','aiwlm3azfr6ryc2mx64mqo6b',100,'RECHARGE',NULL,'Test recharge',NULL,'COMPLETED',2214.76,2314.76,'2025-12-08 16:06:08.773',NULL);
/*!40000 ALTER TABLE `pointsTransactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `productCategories`
--

DROP TABLE IF EXISTS `productCategories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `productCategories` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `parentId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `level` int NOT NULL DEFAULT '1',
  `sort` int NOT NULL DEFAULT '0',
  `icon` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `productCategoriesParentIdFkey` (`parentId`),
  KEY `idx_categories_level_sort` (`isActive`,`level`,`sort`),
  KEY `idx_categories_parent_active` (`isActive`,`parentId`),
  KEY `idx_categories_active_sort` (`isActive`,`sort`),
  CONSTRAINT `productCategories_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `productCategories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `productCategories`
--

LOCK TABLES `productCategories` WRITE;
/*!40000 ALTER TABLE `productCategories` DISABLE KEYS */;
INSERT INTO `productCategories` VALUES ('cmi1764986137595','五通商品分类',NULL,1,0,NULL,NULL,1,'2025-12-06 01:55:37.595','2025-12-06 01:55:37.595'),('cmi1764986176282','五通商品分类',NULL,1,0,NULL,NULL,1,'2025-12-06 01:56:16.282','2025-12-06 01:56:16.282'),('cmi1764986191607','五通商品分类',NULL,1,0,NULL,NULL,1,'2025-12-06 01:56:31.607','2025-12-06 01:56:31.607'),('cmi1764986215971','五通商品分类',NULL,1,0,NULL,NULL,1,'2025-12-06 01:56:55.971','2025-12-06 01:56:55.971'),('cmi1764986243662','五通商品分类',NULL,1,0,NULL,NULL,1,'2025-12-06 01:57:23.662','2025-12-06 01:57:23.662'),('cmi1764987169748','五通商品分类',NULL,1,0,NULL,NULL,1,'2025-12-06 02:12:49.748','2025-12-06 02:12:49.748'),('cmi1764987270415','五通商品分类',NULL,1,0,NULL,NULL,1,'2025-12-06 02:14:30.415','2025-12-06 02:14:30.415'),('cmi1764987307828','五通商品分类',NULL,1,0,NULL,NULL,1,'2025-12-06 02:15:07.828','2025-12-06 02:15:07.828'),('cmi1764987335712','五通商品分类',NULL,1,0,NULL,NULL,1,'2025-12-06 02:15:35.712','2025-12-06 02:15:35.712'),('cmi1764987356959','五通商品分类',NULL,1,0,NULL,NULL,1,'2025-12-06 02:15:56.959','2025-12-06 02:15:56.959'),('cmi1764987604558','五通商品分类',NULL,1,0,NULL,NULL,1,'2025-12-06 02:20:04.558','2025-12-06 02:20:04.558'),('cmi1764987677571','五通商品分类',NULL,1,0,NULL,NULL,1,'2025-12-06 02:21:17.571','2025-12-06 02:21:17.571'),('cmi1764987796247','五通商品分类',NULL,1,0,NULL,NULL,1,'2025-12-06 02:23:16.247','2025-12-06 02:23:16.247'),('cmi1764987860849','五通商品分类',NULL,1,0,NULL,NULL,1,'2025-12-06 02:24:20.849','2025-12-06 02:24:20.849'),('cmi1764987879943','五通商品分类',NULL,1,0,NULL,NULL,1,'2025-12-06 02:24:39.943','2025-12-06 02:24:39.943'),('cmi1764987895907','五通商品分类',NULL,1,0,NULL,NULL,1,'2025-12-06 02:24:55.907','2025-12-06 02:24:55.907'),('cmi1764988089644','五通商品分类',NULL,1,0,NULL,NULL,1,'2025-12-06 02:28:09.644','2025-12-06 02:28:09.644'),('ehh6bhrkoutsqhag3bqoa27l','食品饮料',NULL,1,2,'food','食品饮料相关产品',1,'2025-12-05 09:23:04.933','2025-12-05 09:23:04.933'),('int2lhm6kvgfklpoa5jwqkoq','保健品',NULL,1,1,'food','保健品相关产品',1,'2025-12-05 09:23:04.924','2025-12-05 09:23:04.924'),('qeir4pdmipe78hph17a7xomh','护肤品',NULL,1,0,'skincare','护肤品相关产品',1,'2025-12-05 09:23:04.911','2025-12-05 09:23:04.911');
/*!40000 ALTER TABLE `productCategories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `productPricings`
--

DROP TABLE IF EXISTS `productPricings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `productPricings` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `productId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `specId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `userLevel` enum('NORMAL','VIP','STAR_1','STAR_2','STAR_3','STAR_4','STAR_5','DIRECTOR') COLLATE utf8mb4_unicode_ci NOT NULL,
  `price` double NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `productPricings_productId_specId_userLevel_key` (`productId`,`specId`,`userLevel`),
  KEY `productPricingsSpecIdFkey` (`specId`),
  KEY `idx_pricings_product_level` (`productId`,`userLevel`),
  CONSTRAINT `productPricings_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `productPricings_specId_fkey` FOREIGN KEY (`specId`) REFERENCES `productSpecs` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `productPricings`
--

LOCK TABLES `productPricings` WRITE;
/*!40000 ALTER TABLE `productPricings` DISABLE KEYS */;
/*!40000 ALTER TABLE `productPricings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `categoryId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `code` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sku` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `basePrice` double NOT NULL,
  `totalStock` int NOT NULL DEFAULT '0',
  `minStock` int NOT NULL DEFAULT '10',
  `images` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `videoUrl` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `details` json DEFAULT NULL,
  `status` enum('ACTIVE','INACTIVE','PRESALE','OUT_OF_STOCK') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `isFeatured` tinyint(1) NOT NULL DEFAULT '0',
  `sort` int NOT NULL DEFAULT '0',
  `scheduleOnAt` datetime(3) DEFAULT NULL,
  `scheduleOffAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `shopId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `products_code_key` (`code`),
  UNIQUE KEY `products_sku_key` (`sku`),
  KEY `productsCategoryIdFkey` (`categoryId`),
  KEY `productsShopIdFkey` (`shopId`),
  KEY `idx_products_status_featured` (`status`,`isFeatured`,`sort`,`createdAt`),
  KEY `idx_products_status_category` (`status`,`categoryId`,`sort`),
  KEY `idx_products_status_sort` (`status`,`sort`,`createdAt`),
  KEY `idx_products_name` (`name`),
  KEY `idx_products_code` (`code`),
  KEY `idx_products_sku` (`sku`),
  CONSTRAINT `products_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `productCategories` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `products_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shops` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` VALUES ('af1xnw3okkoc65ttcu90syst','ehh6bhrkoutsqhag3bqoa27l','Ergonomic Plastic Ball','New maroon Pants with ergonomic design for creamy comfort','PRDHTRW2UTS','SKUD6THJIEN',1694.07,384,10,'[\"https://picsum.photos/seed/xan6NK/800/600\"]',NULL,NULL,'ACTIVE',0,19,NULL,NULL,'2025-10-24 02:05:41.702','2025-12-05 09:23:05.158',NULL),('aleh8twia0c22fngl9bt0xet','ehh6bhrkoutsqhag3bqoa27l','Practical Rubber Soap','Discover the beloved new Cheese with an exciting mix of Concrete ingredients','PRD8NHHA3D3','SKUODD3IDHP',375.28,619,10,'[\"https://picsum.photos/seed/3YVZMThg0m/800/600\"]',NULL,NULL,'ACTIVE',0,1,NULL,NULL,'2025-11-23 08:43:35.974','2025-12-05 09:23:04.954',NULL),('axkw73u0v6kyz2skh67awrn7','qeir4pdmipe78hph17a7xomh','Gorgeous Ceramic Chair','Introducing the Armenia-inspired Hat, blending winding style with local craftsmanship','PRDQUUCO05F','SKURZQYKZR4',697.38,423,10,'[\"https://picsum.photos/seed/5kocfI7/800/600\"]',NULL,NULL,'ACTIVE',0,11,NULL,NULL,'2025-10-08 03:10:00.018','2025-12-05 09:23:05.076',NULL),('deam8dz1pf1fbn3n59z1jscx','int2lhm6kvgfklpoa5jwqkoq','Oriental Aluminum Chicken','Stylish Towels designed to make you stand out with avaricious looks','PRDVUZM2TSS','SKULN6P9J26',612.62,223,10,'[\"https://picsum.photos/seed/CW0G4S/800/600\"]',NULL,NULL,'ACTIVE',0,14,NULL,NULL,'2025-05-11 17:50:49.693','2025-12-05 09:23:05.107',NULL),('f92a5y9unsybpc61e2zxg7wx','ehh6bhrkoutsqhag3bqoa27l','Fresh Wooden Tuna','Experience the tan brilliance of our Sausages, perfect for orderly environments','PRDGZGX6CQN','SKUJSVBID8D',1833.01,742,10,'[\"https://picsum.photos/seed/1ABu1tA95/800/600\"]',NULL,NULL,'ACTIVE',0,8,NULL,NULL,'2025-12-01 03:08:18.595','2025-12-05 09:23:05.039',NULL),('fhb3oqavucxiz3241h95lzo7','ehh6bhrkoutsqhag3bqoa27l','Awesome Bamboo Table','Professional-grade Car perfect for muffled training and recreational use','PRDARFIGN5Q','SKUAOBCSMPK',931.45,828,10,'[\"https://picsum.photos/seed/PXuUHa/800/600\"]',NULL,NULL,'ACTIVE',0,0,NULL,NULL,'2024-12-27 02:56:28.436','2025-12-05 09:23:04.943',NULL),('g3l8kyixi9moxhg4txxqvoer','ehh6bhrkoutsqhag3bqoa27l','Soft Steel Towels','The Future-proofed maximized application Hat offers reliable performance and amazing design','PRD3RBMVZMU','SKUTFFZQUKU',1157.9,889,10,'[\"https://picsum.photos/seed/DAQYYW3i6/800/600\"]',NULL,NULL,'ACTIVE',0,13,NULL,NULL,'2025-10-31 14:09:01.647','2025-12-05 09:23:05.099',NULL),('gsfwdqlxvsbcof3e4vh3y5fv','int2lhm6kvgfklpoa5jwqkoq','Tasty Steel Keyboard','Savor the juicy essence in our Chicken, designed for friendly culinary adventures','PRDU6UNZIL3','SKUZV2XBX1W',1354.99,924,10,'[\"https://picsum.photos/seed/5fKr1N7rH/800/600\"]',NULL,NULL,'ACTIVE',0,12,NULL,NULL,'2025-06-27 04:42:07.521','2025-12-05 09:23:05.087',NULL),('gykbgioifd1kmoouuoq0kbbc','int2lhm6kvgfklpoa5jwqkoq','Bespoke Aluminum Sausages','Savor the moist essence in our Bacon, designed for basic culinary adventures','PRDB206GEMC','SKUBVA4ZNLT',1424.8,586,10,'[\"https://picsum.photos/seed/5xYLVJRNH/800/600\"]',NULL,NULL,'ACTIVE',0,3,NULL,NULL,'2025-06-16 13:15:47.335','2025-12-05 09:23:04.978',NULL),('i5rqi83bkwfkjxe38ufvqr7f','ehh6bhrkoutsqhag3bqoa27l','Fantastic Wooden Sausages','Savor the zesty essence in our Shirt, designed for infinite culinary adventures','PRDC7HAGBEW','SKU254V6EKP',222.7,628,10,'[\"https://picsum.photos/seed/W1OkYlU/800/600\"]',NULL,NULL,'ACTIVE',0,15,NULL,NULL,'2025-10-08 04:56:22.600','2025-12-05 09:23:05.117',NULL),('ktfgif8fjno0wbnoddpe519c','int2lhm6kvgfklpoa5jwqkoq','Fantastic Wooden Bacon','Generic Table designed with Rubber for smooth performance','PRDEQ1LB5UC','SKUNJFS7QUT',840.35,710,10,'[\"https://picsum.photos/seed/ePElYrAG8/800/600\"]',NULL,NULL,'ACTIVE',0,2,NULL,NULL,'2025-05-15 10:24:29.528','2025-12-05 09:23:04.965',NULL),('n7ud6v4eeyo0ghcdr0hatake','ehh6bhrkoutsqhag3bqoa27l','Incredible Ceramic Table','Discover the black new Hat with an exciting mix of Bronze ingredients','PRD3HWFQLRO','SKU0R69TQPH',1744.52,70,10,'[\"https://picsum.photos/seed/ZOD3wx5/800/600\"]',NULL,NULL,'ACTIVE',0,7,NULL,NULL,'2025-08-31 22:34:38.533','2025-12-05 09:23:05.024',NULL),('p7cyyz2gf8ebqizyznvl4pud','ehh6bhrkoutsqhag3bqoa27l','Handmade Granite Pizza','Practical Chips designed with Steel for negligible performance','PRD0TDQAR1K','SKUBGFIBL1P',678.17,681,10,'[\"https://picsum.photos/seed/Jhigf2xxOw/800/600\"]',NULL,NULL,'ACTIVE',0,9,NULL,NULL,'2025-01-19 07:45:01.311','2025-12-05 09:23:05.050',NULL),('pbx4qvhxmj9ig6t2ihqqgpj9','qeir4pdmipe78hph17a7xomh','Intelligent Plastic Car','New Towels model with 49 GB RAM, 964 GB storage, and dutiful features','PRDTISXR7GQ','SKUNYUK4LQM',1567.71,905,10,'[\"https://picsum.photos/seed/7hIba/800/600\"]',NULL,NULL,'ACTIVE',0,5,NULL,NULL,'2025-08-04 11:32:01.418','2025-12-05 09:23:05.003',NULL),('q0fqk0vx9cvjtpufi2ufnjc4','ehh6bhrkoutsqhag3bqoa27l','Fresh Cotton Salad','The Triple-buffered responsive throughput Sausages offers reliable performance and right design','PRDHCVAUTVF','SKUWWSL1N35',485.21,785,10,'[\"https://picsum.photos/seed/7f1BYC/800/600\"]',NULL,NULL,'ACTIVE',0,16,NULL,NULL,'2024-12-30 09:21:03.665','2025-12-05 09:23:05.127',NULL),('syko8nh7gptzfoasrzb316db','qeir4pdmipe78hph17a7xomh','Elegant Concrete Gloves','Featuring Xenon-enhanced technology, our Cheese offers unparalleled shadowy performance','PRDWMXQCAQ9','SKUFMMQQ8QO',266.44,802,10,'[\"https://picsum.photos/seed/39bPK/800/600\"]',NULL,NULL,'ACTIVE',0,4,NULL,NULL,'2025-11-10 00:26:59.063','2025-12-05 09:23:04.990',NULL),('t2zbmas9xx8vsds7wruvhnk6','int2lhm6kvgfklpoa5jwqkoq','Gorgeous Cotton Hat','The sleek and long Chair comes with teal LED lighting for smart functionality','PRDHTPA77DL','SKUPNUVXAOM',1763,837,10,'[\"https://picsum.photos/seed/eX096/800/600\"]',NULL,NULL,'ACTIVE',0,6,NULL,NULL,'2025-10-02 14:43:13.159','2025-12-05 09:23:05.014',NULL),('tcm6ec0lo026qyk6qms842ay','qeir4pdmipe78hph17a7xomh','Bespoke Cotton Mouse','Introducing the Heard Island and McDonald Islands-inspired Pants, blending smooth style with local craftsmanship','PRDYJ5LDQD2','SKU1RJWGJTD',1270.47,830,10,'[\"https://picsum.photos/seed/8jmoztex/800/600\"]',NULL,NULL,'ACTIVE',0,18,NULL,NULL,'2025-10-07 05:13:31.642','2025-12-05 09:23:05.148',NULL),('ux01uexnp2zl623bbq4el834','int2lhm6kvgfklpoa5jwqkoq','Electronic Gold Salad','Discover the hospitable new Chicken with an exciting mix of Granite ingredients','PRD1LVRQOIO','SKUUUKGE6FS',1248.42,426,10,'[\"https://picsum.photos/seed/CGq9o/800/600\"]',NULL,NULL,'ACTIVE',0,17,NULL,NULL,'2025-04-06 13:31:21.012','2025-12-05 09:23:05.137',NULL),('y8vz17583gb3pmk8errrc30g','int2lhm6kvgfklpoa5jwqkoq','Tasty Wooden Table','Savor the crunchy essence in our Pizza, designed for late culinary adventures','PRDSSM8O5ZF','SKU4KSQ6TUW',564.23,234,10,'[\"https://picsum.photos/seed/aMPoKbRR/800/600\"]',NULL,NULL,'ACTIVE',0,10,NULL,NULL,'2025-03-06 06:52:23.899','2025-12-05 09:23:05.063',NULL);
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `productSpecs`
--

DROP TABLE IF EXISTS `productSpecs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `productSpecs` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `productId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sku` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `price` double NOT NULL,
  `stock` int NOT NULL DEFAULT '0',
  `minStock` int NOT NULL DEFAULT '10',
  `images` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `sort` int NOT NULL DEFAULT '0',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `productSpecs_sku_key` (`sku`),
  KEY `productSpecsProductIdFkey` (`productId`),
  KEY `idx_specs_product_active_sort` (`productId`,`isActive`,`sort`),
  KEY `idx_specs_product_name` (`productId`,`name`),
  KEY `idx_specs_active_sort` (`isActive`,`sort`),
  CONSTRAINT `productSpecs_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `productSpecs`
--

LOCK TABLES `productSpecs` WRITE;
/*!40000 ALTER TABLE `productSpecs` DISABLE KEYS */;
/*!40000 ALTER TABLE `productSpecs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `productTagLinks`
--

DROP TABLE IF EXISTS `productTagLinks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `productTagLinks` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `productId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tagId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `productTagLinks_productId_tagId_key` (`productId`,`tagId`),
  KEY `productTagLinksTagIdFkey` (`tagId`),
  CONSTRAINT `productTagLinks_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `productTagLinks_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `productTags` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `productTagLinks`
--

LOCK TABLES `productTagLinks` WRITE;
/*!40000 ALTER TABLE `productTagLinks` DISABLE KEYS */;
/*!40000 ALTER TABLE `productTagLinks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `productTags`
--

DROP TABLE IF EXISTS `productTags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `productTags` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `color` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sort` int NOT NULL DEFAULT '0',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `productTags_name_key` (`name`),
  KEY `idx_tags_name_sort` (`name`,`sort`),
  KEY `idx_tags_sort` (`sort`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `productTags`
--

LOCK TABLES `productTags` WRITE;
/*!40000 ALTER TABLE `productTags` DISABLE KEYS */;
INSERT INTO `productTags` VALUES ('cmi1764988777600','新品','#FF0000','新品标签',0,'2025-12-06 02:39:37.598','2025-12-06 02:39:37.598');
/*!40000 ALTER TABLE `productTags` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchaseOrders`
--

DROP TABLE IF EXISTS `purchaseOrders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchaseOrders` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `orderNo` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `buyerId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sellerId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `productId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` int NOT NULL,
  `unitPrice` double NOT NULL,
  `totalAmount` double NOT NULL,
  `purchasePath` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `commissionDetails` json DEFAULT NULL,
  `status` enum('PENDING','APPROVED','REJECTED','COMPLETED','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `completedAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `purchaseOrders_orderNo_key` (`orderNo`),
  KEY `purchaseOrdersBuyerIdFkey` (`buyerId`),
  KEY `purchaseOrdersProductIdFkey` (`productId`),
  KEY `purchaseOrdersSellerIdFkey` (`sellerId`),
  CONSTRAINT `purchaseOrders_buyerId_fkey` FOREIGN KEY (`buyerId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `purchaseOrders_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `purchaseOrders_sellerId_fkey` FOREIGN KEY (`sellerId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchaseOrders`
--

LOCK TABLES `purchaseOrders` WRITE;
/*!40000 ALTER TABLE `purchaseOrders` DISABLE KEYS */;
/*!40000 ALTER TABLE `purchaseOrders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `referralRelationships`
--

DROP TABLE IF EXISTS `referralRelationships`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `referralRelationships` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `referrerId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `refereeId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `relationshipType` enum('DIRECT','INDIRECT','NETWORK') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DIRECT',
  `level` int NOT NULL DEFAULT '1',
  `path` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `referralSales` double NOT NULL DEFAULT '0',
  `referralCommission` double NOT NULL DEFAULT '0',
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `establishedDate` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `lastActiveDate` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `referralRelationships`
--

LOCK TABLES `referralRelationships` WRITE;
/*!40000 ALTER TABLE `referralRelationships` DISABLE KEYS */;
/*!40000 ALTER TABLE `referralRelationships` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `securityLogs`
--

DROP TABLE IF EXISTS `securityLogs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `securityLogs` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `adminId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('LOGIN_FAILED','IP_BLOCKED','SESSION_TIMEOUT','SUSPICIOUS_OPERATION','TOKEN_INVALID') COLLATE utf8mb4_unicode_ci NOT NULL,
  `ipAddress` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userAgent` text COLLATE utf8mb4_unicode_ci,
  `details` text COLLATE utf8mb4_unicode_ci,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `securityLogs_adminId_idx` (`adminId`),
  KEY `securityLogs_type_idx` (`type`),
  KEY `securityLogs_ipAddress_idx` (`ipAddress`),
  KEY `securityLogs_createdAt_idx` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `securityLogs`
--

LOCK TABLES `securityLogs` WRITE;
/*!40000 ALTER TABLE `securityLogs` DISABLE KEYS */;
/*!40000 ALTER TABLE `securityLogs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `shops`
--

DROP TABLE IF EXISTS `shops`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shops` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `shopType` enum('CLOUD','WUTONG') COLLATE utf8mb4_unicode_ci NOT NULL,
  `shopLevel` int NOT NULL DEFAULT '1',
  `shopName` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `shopDescription` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contactName` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contactPhone` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `totalSales` double NOT NULL DEFAULT '0',
  `totalOrders` int NOT NULL DEFAULT '0',
  `totalRevenue` double NOT NULL DEFAULT '0',
  `status` enum('PENDING','APPROVED','ACTIVE','SUSPENDED','CLOSED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `shopsUserIdFkey` (`userId`),
  CONSTRAINT `shops_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shops`
--

LOCK TABLES `shops` WRITE;
/*!40000 ALTER TABLE `shops` DISABLE KEYS */;
INSERT INTO `shops` VALUES ('b69g8kamb4v62ogoc84xxyhg','wxp0vacz74wiajnp1jmd2p95','CLOUD',4,'Betsy Graham的云店',NULL,'Betsy Graham','735-865-1267 x82896','37687 Bednar Fields',0,0,0,'ACTIVE','2025-11-24 04:14:38.599','2025-12-05 09:23:05.198'),('bns4r2mgyyx8is58d9r4pex9','cr64xrf5tk5k2t04ihxpry8k','CLOUD',3,'测试更新',NULL,'Ryan Becker','707.377.8272 x545','106 Veum Islands',0,0,0,'ACTIVE','2025-05-04 23:17:59.029','2025-12-05 09:23:05.175'),('cminydulpe57uw2zvqdewdlr79j','cr64xrf5tk5k2t04ihxpry8k','CLOUD',1,'测试云店','测试描述','测试联系人','13800138001','测试地址',0,0,0,'ACTIVE','2025-12-06 00:29:03.776','2025-12-06 00:29:03.774'),('enl5lfa7q0h2vaxrwark8yiv','imh9off5zi3qg63uaw27igom','CLOUD',3,'Dr. Theresa Halvorson的云店',NULL,'Dr. Theresa Halvorson','1-759-378-8017 x2787','797 Lueilwitz Manors',0,0,0,'ACTIVE','2025-07-12 01:49:47.107','2025-12-05 09:23:05.186');
/*!40000 ALTER TABLE `shops` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `smsVerifications`
--

DROP TABLE IF EXISTS `smsVerifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `smsVerifications` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('BIND','UNBIND','LOGIN','TRANSFER') COLLATE utf8mb4_unicode_ci NOT NULL,
  `attempts` int NOT NULL DEFAULT '0',
  `isUsed` tinyint(1) NOT NULL DEFAULT '0',
  `expiresAt` datetime(3) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `smsVerifications`
--

LOCK TABLES `smsVerifications` WRITE;
/*!40000 ALTER TABLE `smsVerifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `smsVerifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `systemConfigs`
--

DROP TABLE IF EXISTS `systemConfigs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `systemConfigs` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `key` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `category` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('JSON','STRING','NUMBER','BOOLEAN','ARRAY') COLLATE utf8mb4_unicode_ci NOT NULL,
  `lastModifiedBy` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `isEditable` tinyint(1) NOT NULL DEFAULT '1',
  `isSystem` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `systemConfigs_key_key` (`key`),
  KEY `systemConfigs_category_idx` (`category`),
  KEY `systemConfigs_type_idx` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `systemConfigs`
--

LOCK TABLES `systemConfigs` WRITE;
/*!40000 ALTER TABLE `systemConfigs` DISABLE KEYS */;
INSERT INTO `systemConfigs` VALUES ('b8r769j7xofuklnz1ondujrs','points_transfer_fee_rate','0.01',NULL,'points','NUMBER',NULL,'2025-12-05 07:58:54.727','2025-12-10 08:37:01.743',1,0),('co1a9p63zgt5yb08guu6v9dl','order_refund_days','7',NULL,'order','NUMBER',NULL,'2025-12-05 07:58:54.755','2025-12-10 08:37:01.777',1,0),('en3j4arg1nwsm76f2epq55ph','inventory_auto_reorder_quantity','100',NULL,'inventory','NUMBER',NULL,'2025-12-05 07:58:54.798','2025-12-10 08:37:01.847',1,0),('fcrqp2256xv68r3w5dlh0fma','commission_personal_rate','0.05',NULL,'commission','NUMBER',NULL,'2025-12-05 07:58:54.638','2025-12-10 08:37:01.635',1,0),('hi1d3kk2nhf5rq9smrcjwrlj','cloud_shop_level_4','{\"level\":4,\"name\":\"四星店长\",\"minBottles\":600,\"minTeamSize\":8,\"minDirectMembers\":2,\"purchaseDiscount\":0.26,\"monthlyTarget\":360000,\"monthlyCommission\":72000,\"description\":\"需要2个三星店长直推\"}','四星店长等级配置','cloud_shop_levels','JSON',NULL,'2025-12-05 07:58:54.594','2025-12-10 08:37:01.585',1,0),('i6ke3srjx5rlqslfax1ccvm5','commission_indirect_referral_rate','0.01',NULL,'commission','NUMBER',NULL,'2025-12-05 07:58:54.663','2025-12-10 08:37:01.655',1,0),('ikuputk5pe3wdqfmf2io5zh0','points_max_transfer_amount','100000',NULL,'points','NUMBER',NULL,'2025-12-05 07:58:54.709','2025-12-10 08:37:01.708',1,0),('irxga1h3x2ttf9i8ydo7jk00','points_freeze_threshold','100000',NULL,'points','NUMBER',NULL,'2025-12-05 07:58:54.735','2025-12-10 08:37:01.755',1,0),('lxx772nme51mq8rcks7lm4fg','cloud_shop_level_6','{\"level\":6,\"name\":\"董事\",\"minBottles\":12000,\"minTeamSize\":32,\"minDirectMembers\":2,\"purchaseDiscount\":0.22,\"monthlyTarget\":6000000,\"monthlyCommission\":1320000,\"description\":\"需要2个五星店长直推\"}','董事等级配置','cloud_shop_levels','JSON',NULL,'2025-12-05 07:58:54.625','2025-12-10 08:37:01.615',1,0),('mvuxzyljf0n5gm2hx5brkktb','order_auto_cancel_minutes','30',NULL,'order','NUMBER',NULL,'2025-12-05 07:58:54.745','2025-12-10 08:37:01.765',1,0),('p51wao6f6oxhyxzzbcaxy7w0','order_default_shipping_fee','10',NULL,'order','NUMBER',NULL,'2025-12-05 07:58:54.764','2025-12-10 08:37:01.789',1,0),('qevhtupiamsm8y2yg4lgmdej','cloud_shop_level_1','{\"level\":1,\"name\":\"一星店长\",\"minBottles\":4,\"minTeamSize\":0,\"minDirectMembers\":0,\"purchaseDiscount\":0.4,\"monthlyTarget\":2400,\"monthlyCommission\":600,\"description\":\"基础店长等级，无团队要求\"}','一星店长等级配置','cloud_shop_levels','JSON',NULL,'2025-12-05 07:58:54.540','2025-12-10 08:37:01.515',1,0),('qfsrcc3r8qx1yya73bbix0th','order_free_shipping_threshold','200',NULL,'order','NUMBER',NULL,'2025-12-05 07:58:54.772','2025-12-10 08:37:01.817',1,0),('r19loceay6vxe25w10c9yhq5','points_min_transfer_amount','1',NULL,'points','NUMBER',NULL,'2025-12-05 07:58:54.700','2025-12-10 08:37:01.699',1,0),('sdfnthz012xwthhcoduce6pc','inventory_warning_threshold','10',NULL,'inventory','NUMBER',NULL,'2025-12-05 07:58:54.781','2025-12-10 08:37:01.827',1,0),('sfp8fqrfcox2zdrlb8x37rrf','cloud_shop_level_3','{\"level\":3,\"name\":\"三星店长\",\"minBottles\":120,\"minTeamSize\":4,\"minDirectMembers\":2,\"purchaseDiscount\":0.3,\"monthlyTarget\":72000,\"monthlyCommission\":15000,\"description\":\"需要2个二星店长直推\"}','三星店长等级配置','cloud_shop_levels','JSON',NULL,'2025-12-05 07:58:54.584','2025-12-10 08:37:01.563',1,0),('soah08n4oc2ru1t1ya92529r','commission_performance_threshold','10000',NULL,'commission','NUMBER',NULL,'2025-12-05 07:58:54.692','2025-12-10 08:37:01.691',1,0),('szdburv5ndqtniku9vt9qzat','cloud_shop_level_5','{\"level\":5,\"name\":\"五星店长\",\"minBottles\":2400,\"minTeamSize\":16,\"minDirectMembers\":2,\"purchaseDiscount\":0.24,\"monthlyTarget\":1200000,\"monthlyCommission\":288000,\"description\":\"需要2个四星店长直推\"}','五星店长等级配置','cloud_shop_levels','JSON',NULL,'2025-12-05 07:58:54.611','2025-12-10 08:37:01.604',1,0),('uk7jminasxa76onytj3sktfc','commission_direct_referral_rate','0.02',NULL,'commission','NUMBER',NULL,'2025-12-05 07:58:54.652','2025-12-10 08:37:01.646',1,0),('v1py8heq0g7l9itbdm32xu4q','commission_team_bonus_rate','0.03',NULL,'commission','NUMBER',NULL,'2025-12-05 07:58:54.673','2025-12-10 08:37:01.673',1,0),('wlmx34rwksmry68zoxee53tq','commission_level_bonus_rate','0.02',NULL,'commission','NUMBER',NULL,'2025-12-05 07:58:54.683','2025-12-10 08:37:01.682',1,0),('x2agfbfjkfhb50gee9j422y0','inventory_auto_reorder_enabled','false',NULL,'inventory','BOOLEAN',NULL,'2025-12-05 07:58:54.789','2025-12-10 08:37:01.838',1,0),('y7i02ijjyoll43y5mnq2lyly','points_daily_transfer_limit','1000000',NULL,'points','NUMBER',NULL,'2025-12-05 07:58:54.718','2025-12-10 08:37:01.718',1,0),('yowi6t1tjbudvqbu0mb4pyah','cloud_shop_level_2','{\"level\":2,\"name\":\"二星店长\",\"minBottles\":20,\"minTeamSize\":2,\"minDirectMembers\":2,\"purchaseDiscount\":0.35,\"monthlyTarget\":12000,\"monthlyCommission\":3000,\"description\":\"需要2个一星店长直推\"}','二星店长等级配置','cloud_shop_levels','JSON',NULL,'2025-12-05 07:58:54.572','2025-12-10 08:37:01.544',1,0);
/*!40000 ALTER TABLE `systemConfigs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `teamMembers`
--

DROP TABLE IF EXISTS `teamMembers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `teamMembers` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `teamId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('MEMBER','CAPTAIN','MANAGER','DIRECTOR','SENIOR_DIRECTOR','PARTNER','AMBASSADOR') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'MEMBER',
  `level` int NOT NULL DEFAULT '1',
  `status` enum('ACTIVE','INACTIVE','SUSPENDED','TERMINATED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `position` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `referrerId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `uplineId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `personalSales` double NOT NULL DEFAULT '0',
  `teamSales` double NOT NULL DEFAULT '0',
  `directCount` int NOT NULL DEFAULT '0',
  `teamCount` int NOT NULL DEFAULT '0',
  `joinDate` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `promotedDate` datetime(3) DEFAULT NULL,
  `lastActiveDate` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `teamMembers_userId_key` (`userId`),
  KEY `teamMembersTeamIdFkey` (`teamId`),
  CONSTRAINT `teamMembers_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `teams` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `teamMembers_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `teamMembers`
--

LOCK TABLES `teamMembers` WRITE;
/*!40000 ALTER TABLE `teamMembers` DISABLE KEYS */;
/*!40000 ALTER TABLE `teamMembers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `teams`
--

DROP TABLE IF EXISTS `teams`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `teams` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `leaderId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `totalMembers` int NOT NULL DEFAULT '0',
  `activeMembers` int NOT NULL DEFAULT '0',
  `totalLevels` int NOT NULL DEFAULT '1',
  `totalSales` double NOT NULL DEFAULT '0',
  `status` enum('ACTIVE','INACTIVE','SUSPENDED','TERMINATED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `establishedDate` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `teamsLeaderIdFkey` (`leaderId`),
  CONSTRAINT `teams_leaderId_fkey` FOREIGN KEY (`leaderId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `teams`
--

LOCK TABLES `teams` WRITE;
/*!40000 ALTER TABLE `teams` DISABLE KEYS */;
/*!40000 ALTER TABLE `teams` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `openid` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nickname` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `avatarUrl` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `level` enum('NORMAL','VIP','STAR_1','STAR_2','STAR_3','STAR_4','STAR_5','DIRECTOR') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'NORMAL',
  `status` enum('ACTIVE','INACTIVE','SUSPENDED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `parentId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `teamPath` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `teamLevel` int NOT NULL DEFAULT '1',
  `totalSales` double NOT NULL DEFAULT '0',
  `totalBottles` int NOT NULL DEFAULT '0',
  `directSales` double NOT NULL DEFAULT '0',
  `teamSales` double NOT NULL DEFAULT '0',
  `directCount` int NOT NULL DEFAULT '0',
  `teamCount` int NOT NULL DEFAULT '0',
  `cloudShopLevel` int DEFAULT NULL,
  `hasWutongShop` tinyint(1) NOT NULL DEFAULT '0',
  `pointsBalance` double NOT NULL DEFAULT '0',
  `pointsFrozen` double NOT NULL DEFAULT '0',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `lastLoginAt` datetime(3) DEFAULT NULL,
  `referralCode` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `userNumber` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `password` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_openid_key` (`openid`),
  UNIQUE KEY `users_phone_key` (`phone`),
  UNIQUE KEY `users_referralCode_key` (`referralCode`),
  UNIQUE KEY `users_userNumber_key` (`userNumber`),
  KEY `usersParentIdFkey` (`parentId`),
  KEY `idx_users_phone_id` (`phone`,`id`),
  CONSTRAINT `users_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES ('aiwlm3azfr6ryc2mx64mqo6b','user_7_inijZBJPVH7ZKguclhjH','Ross Schoen',NULL,'(755) 856-1006 x590','NORMAL','ACTIVE',NULL,NULL,1,0,0,0,0,0,0,NULL,0,2214.76,0,'2025-06-12 23:48:14.640','2025-12-05 09:23:04.821',NULL,'6GLKU9IV',NULL,NULL),('cr64xrf5tk5k2t04ihxpry8k','vip_0_EqqESNAmzIjHeerNcwsr','Ryan Becker',NULL,'707.377.8272 x545','VIP','ACTIVE',NULL,NULL,1,0,0,0,0,0,0,NULL,0,9755.5,0,'2025-03-05 22:47:50.319','2025-12-05 09:23:04.855',NULL,'B8JVCBOH',NULL,NULL),('e2bafvp0grfc39ihhr89hbgb','user_4_bhOj4ZfUhOVTwut2ous4','Mr. John Leuschke',NULL,'1-539-394-4092 x81940','NORMAL','ACTIVE',NULL,NULL,1,0,0,0,0,0,0,NULL,0,2770.49,0,'2025-09-17 03:49:11.064','2025-12-05 09:23:04.786',NULL,'IGNPNKVD',NULL,NULL),('etwb9rsr17qdot78mwguwhk0','user_9_Pu6vKo1HKkYKE68DkA0l','Mr. Gustavo Dickens-Greenholt',NULL,'(233) 845-9255 x83551','NORMAL','ACTIVE',NULL,NULL,1,0,0,0,0,0,0,NULL,0,770.55,0,'2025-04-29 18:13:07.623','2025-12-05 09:23:04.845',NULL,'OTS5X0EK',NULL,NULL),('imh9off5zi3qg63uaw27igom','vip_2_hnrarEe49pfYIupN3DaJ','Dr. Theresa Halvorson',NULL,'1-759-378-8017 x2787','VIP','ACTIVE',NULL,NULL,1,0,0,0,0,0,0,NULL,0,9340.75,0,'2025-04-16 02:33:52.862','2025-12-05 09:23:04.880',NULL,'ZEFYIVPA',NULL,NULL),('ndf66a7guhvqmy28vthkl4hg','user_6_05yzs4INIphC0rhRYgVK','Harry Ebert',NULL,'1-401-352-1081 x9230','NORMAL','ACTIVE',NULL,NULL,1,0,0,0,0,0,0,NULL,0,2416.08,0,'2025-01-09 09:21:31.591','2025-12-05 09:23:04.809',NULL,'STWJEKMS',NULL,NULL),('no0eaxi252ffdv6zw4df5lje','user_5_9kWOTWfOVNrR6kGh3Mvk','Lola Rosenbaum',NULL,'1-811-205-6223 x339','NORMAL','ACTIVE',NULL,NULL,1,0,0,0,0,0,0,NULL,0,301.02,0,'2025-07-09 01:15:56.628','2025-12-05 09:23:04.798',NULL,'SBDKZJOG',NULL,NULL),('o2kt4zgvn4rmx4mveku8vtop','user_0_w7bpbMN15rGWanqIRHVX','Marcus Mueller',NULL,'1-437-577-9816','NORMAL','ACTIVE',NULL,NULL,1,0,0,0,0,0,0,NULL,0,2421.03,0,'2025-07-31 13:23:38.690','2025-12-05 09:23:04.738',NULL,'ZV9MLPCH',NULL,NULL),('s8fsn6yah4og9ormvrlcfazv','user_3_6VMn0HedzuCyohSpuRgz','Mr. Nicolas McGlynn',NULL,'(817) 951-0752 x71423','NORMAL','ACTIVE',NULL,NULL,1,0,0,0,0,0,0,NULL,0,2205.14,0,'2025-09-30 13:22:04.525','2025-12-05 09:23:04.773',NULL,'JR3ZQ3GW',NULL,NULL),('v5qy9elpkz5varwlkbaurtfo','user_2_x905pojIdncVjN9IAlfQ','Amber Auer',NULL,'(668) 724-5066 x696','NORMAL','ACTIVE',NULL,NULL,1,0,0,0,0,0,0,NULL,0,2481.65,0,'2025-07-10 19:51:42.629','2025-12-05 09:23:04.762',NULL,'645ZNBOL',NULL,NULL),('vbxu6clwnkvgctrb1gdumqg1','user_1_6q8ZFIzV1sL8HnbGUX3s','Raul Herzog',NULL,'975.726.3337 x95969','NORMAL','ACTIVE',NULL,NULL,1,0,0,0,0,0,0,NULL,0,1261.68,0,'2025-11-09 04:01:54.334','2025-12-05 09:23:04.751',NULL,'1JD3HPFK',NULL,NULL),('wxp0vacz74wiajnp1jmd2p95','vip_1_Np5Gxc5QmzWq13w8t1S1','Betsy Graham',NULL,'735-865-1267 x82896','VIP','ACTIVE',NULL,NULL,1,0,0,0,0,0,0,NULL,0,17408.85,0,'2025-09-04 19:58:51.399','2025-12-05 09:23:04.867',NULL,'ZORE8QKP',NULL,NULL),('xlexb35vac2jq40wngr1sfca','admin_openid_001','系统管理员',NULL,'13800138000','DIRECTOR','ACTIVE',NULL,NULL,1,0,0,0,0,0,0,NULL,0,100000,0,'2025-12-05 09:23:04.699','2025-12-05 09:23:04.699',NULL,'ADMIN01',NULL,NULL),('zksj4n4zl6ecm8rt0f2240aa','user_8_XFq4WX2mZ91nltjuHz8R','Mr. Arturo Hayes',NULL,'824-744-1872','NORMAL','ACTIVE',NULL,NULL,1,0,0,0,0,0,0,NULL,0,4178.34,0,'2025-10-02 21:28:58.996','2025-12-05 09:23:04.833',NULL,'ENYVYSNB',NULL,NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-12-10 14:25:36
