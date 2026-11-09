-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3306
-- Generation Time: Nov 08, 2026 at 02:30 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `aquademia`
--

-- --------------------------------------------------------

--
-- Table structure for table `adaptive_questions`
--

CREATE TABLE `adaptive_questions` (
  `adaptive_id` int(11) NOT NULL,
  `attempt_id` int(11) NOT NULL,
  `question_text` text NOT NULL,
  `options_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`options_json`)),
  `correct_answer` varchar(255) NOT NULL,
  `explanation` text DEFAULT NULL,
  `skill` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `adaptive_questions`
--

INSERT INTO `adaptive_questions` (`adaptive_id`, `attempt_id`, `question_text`, `options_json`, `correct_answer`, `explanation`, `skill`) VALUES
(1, 2, 'What is 350 + 270?', '[\"610\", \"620\", \"630\", \"640\"]', '620', 'Add the hundreds (300+200=500) and the tens (50+70=120). 500+120=620.', 'addition'),
(2, 2, 'What is 485 + 215?', '[\"690\", \"700\", \"710\", \"720\"]', '700', 'Add hundreds (400+200=600) and tens‑ones (85+15=100). 600+100=700.', 'addition'),
(3, 2, 'What is 639 + 158?', '[\"787\", \"797\", \"807\", \"817\"]', '797', 'Add hundreds (600+100=700) and tens‑ones (39+58=97). 700+97=797.', 'addition'),
(4, 4, 'What is 350 + 270?', '[\"610\", \"620\", \"630\", \"640\"]', '620', 'Add the tens (50+70=120) and the hundreds (300+200=500); 500+120=620.', 'addition'),
(5, 4, 'What is 145 + 289?', '[\"424\", \"434\", \"444\", \"454\"]', '434', 'Add units (5+9=14, write 4 carry 1), tens (4+8+1=13, write 3 carry 1), hundreds (1+2+1=4); result 434.', 'addition'),
(6, 4, 'What is 600 + 175?', '[\"765\", \"775\", \"785\", \"795\"]', '775', 'Add units (0+5=5), tens (0+7=7), hundreds (6+1=7); total 775.', 'addition'),
(7, 6, 'What is 350 + 270?', '[\"610\", \"620\", \"600\", \"580\"]', '620', 'Add the tens (5+7=12) write 2 and carry 1, then add the hundreds (3+2+1=6) to get 620.', 'addition'),
(8, 6, 'What is 495 + 128?', '[\"613\", \"623\", \"603\", \"633\"]', '623', 'Add units (5+8=13) write 3 carry 1, tens (9+2+1=12) write 2 carry 1, hundreds (4+1+1=6) gives 623.', 'addition'),
(9, 6, 'What is 764 + 289?', '[\"1053\", \"1043\", \"1063\", \"1033\"]', '1053', 'Add units (4+9=13) write 3 carry 1, tens (6+8+1=15) write 5 carry 1, hundreds (7+2+1=10) gives 1053.', 'addition'),
(10, 8, 'What is 147 + 268?', '[\"405\", \"415\", \"425\", \"435\"]', '415', 'Add units: 7+8=15, write 5 carry 1. Tens: 4+6+1=11, write 1 carry 1. Hundreds: 1+2+1=4. Result is 415.', 'addition'),
(11, 8, 'What is 302 + 479?', '[\"771\", \"781\", \"791\", \"801\"]', '781', 'Units: 2+9=11, write 1 carry 1. Tens: 0+7+1=8. Hundreds: 3+4=7. Result is 781.', 'addition'),
(12, 8, 'What is 618 + 237?', '[\"845\", \"855\", \"865\", \"875\"]', '855', 'Units: 8+7=15, write 5 carry 1. Tens: 1+3+1=5. Hundreds: 6+2=8. Result is 855.', 'addition'),
(13, 9, 'What is 146 + 279?', '[\"415\", \"425\", \"426\", \"436\"]', '425', 'Add 6+9=15, write 5 and carry 1. Then 4+7+1=12, write 2 and carry 1. Finally 1+2+1=4, giving 425.', 'addition'),
(14, 9, 'What is 308 + 467?', '[\"765\", \"775\", \"785\", \"795\"]', '775', '8+7=15, write 5 carry 1. 0+6+1=7, write 7. 3+4=7, giving 775.', 'addition'),
(15, 9, 'What is 532 + 149?', '[\"671\", \"681\", \"691\", \"701\"]', '681', '2+9=11, write 1 carry 1. 3+4+1=8, write 8. 5+1=6, giving 681.', 'addition');

-- --------------------------------------------------------

--
-- Table structure for table `learning_notes`
--

CREATE TABLE `learning_notes` (
  `note_id` int(11) NOT NULL,
  `student_id` int(11) NOT NULL,
  `attempt_id` int(11) NOT NULL,
  `subject` varchar(50) NOT NULL,
  `topic` varchar(100) NOT NULL,
  `weak_skills_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`weak_skills_json`)),
  `notes_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`notes_json`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `learning_notes`
--

INSERT INTO `learning_notes` (`note_id`, `student_id`, `attempt_id`, `subject`, `topic`, `weak_skills_json`, `notes_json`, `created_at`) VALUES
(1, 2, 9, 'Mathematics', 'Addition', '{\"addition\": 1}', '{\"title\": \"Revision Notes: Addition\", \"summary\": \"Great effort! Let\'s strengthen your addition skills by reviewing place value, lining up numbers, and regrouping so you can get the right answer every time.\", \"focus_skills\": [\"addition\"], \"key_concepts\": [{\"heading\": \"Place Value\", \"explanation\": \"Each digit in a number has a value based on its position \\u2013 ones, tens, hundreds, etc. Knowing this helps you add the right columns together.\"}, {\"heading\": \"Line Up the Digits\", \"explanation\": \"Write the numbers one under the other so that the ones, tens and hundreds line up. This makes it easy to add each column.\"}, {\"heading\": \"Regroup (Carrying)\", \"explanation\": \"If a column adds up to 10 or more, write the right\\u2011most digit in that column and carry the extra ten to the next column on the left.\"}], \"worked_example\": {\"question\": \"What is 125 + 235?\", \"steps\": [\"Write the numbers one under the other, lining up the places:  125  + 235\", \"Add the ones: 5 + 5 = 10 \\u2192 write 0 and carry 1 ten.\", \"Add the tens: 2 + 3 = 5, plus the carried 1 = 6 \\u2192 write 6.\", \"Add the hundreds: 1 + 2 = 3 \\u2192 write 3.\", \"Combine the results: 300 + 60 + 0 = 360.\"], \"answer\": \"360\"}, \"revision_tips\": [\"Always line up the numbers by place value before you start adding.\", \"If a column adds to 10 or more, remember to carry the extra ten to the next column.\", \"Check your answer by adding the numbers in reverse order or using a calculator after you finish.\"]}', '2026-11-07 06:42:29');

-- --------------------------------------------------------

--
-- Table structure for table `pearl_transactions`
--

CREATE TABLE `pearl_transactions` (
  `transaction_id` int(11) NOT NULL,
  `student_id` int(11) NOT NULL,
  `inventory_id` int(11) NOT NULL,
  `amount` int(11) NOT NULL,
  `transaction_type` varchar(20) NOT NULL DEFAULT 'purchase',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ;

--
-- Dumping data for table `pearl_transactions`
--

INSERT INTO `pearl_transactions` (`transaction_id`, `student_id`, `inventory_id`, `amount`, `transaction_type`, `created_at`) VALUES
(1, 2, 1, 20, 'purchase', '2026-11-07 05:56:02');

-- --------------------------------------------------------

--
-- Table structure for table `questions`
--

CREATE TABLE `questions` (
  `question_id` int(11) NOT NULL,
  `year_level` tinyint(4) NOT NULL,
  `subject` varchar(50) NOT NULL,
  `topic` varchar(100) NOT NULL,
  `skill` varchar(100) NOT NULL,
  `question_text` text NOT NULL,
  `options_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`options_json`)),
  `correct_answer` varchar(255) NOT NULL,
  `image_path` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `questions`
--

INSERT INTO `questions` (`question_id`, `year_level`, `subject`, `topic`, `skill`, `question_text`, `options_json`, `correct_answer`, `image_path`) VALUES
(1, 4, 'Mathematics', 'Addition', 'addition', 'What is 125 + 235?', '[\"350\", \"360\", \"370\", \"380\"]', '360', NULL),
(2, 4, 'Mathematics', 'Addition', 'addition', 'What is 420 + 180?', '[\"500\", \"600\", \"650\", \"700\"]', '600', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `question_explanations`
--

CREATE TABLE `question_explanations` (
  `explanation_id` int(11) NOT NULL,
  `student_id` int(11) NOT NULL,
  `attempt_id` int(11) NOT NULL,
  `question_id` int(11) NOT NULL,
  `student_answer` varchar(255) DEFAULT NULL,
  `correct_answer` varchar(255) NOT NULL,
  `is_correct` tinyint(1) NOT NULL,
  `explanation` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `question_explanations`
--

INSERT INTO `question_explanations` (`explanation_id`, `student_id`, `attempt_id`, `question_id`, `student_answer`, `correct_answer`, `is_correct`, `explanation`, `created_at`) VALUES
(1, 2, 8, 1, '350', '360', 0, 'To add 125 and 235, line up the numbers by place value:\n\n  125\n+235\n-----\n  360\n\nStart with the ones: 5 + 5 = 10, write 0 and carry 1.\nTens: 2 + 3 = 5, plus the carried 1 makes 6.\nHundreds: 1 + 2 = 3.\nSo the total is 360. Your answer 350 is 10 less because the tens column should be 6, not 5.', '2026-11-07 06:35:38'),
(2, 2, 8, 2, '600', '600', 1, 'Add 420 and 180 by place value:\n\n  420\n+180\n-----\n  600\n\nOnes: 0 + 0 = 0.\nTens: 2 + 8 = 10, write 0 and carry 1.\nHundreds: 4 + 1 = 5, plus the carried 1 makes 6.\nThe sum is 600, which matches your answer. Well done!', '2026-11-07 06:35:38'),
(3, 2, 9, 1, '350', '360', 0, 'To add 125 and 235, line up the numbers by place value. Units: 5 + 5 = 10, write 0 and carry 1. Tens: 2 + 3 = 5, plus the carried 1 makes 6. Hundreds: 1 + 2 = 3. So the total is 360. The answer 350 missed the extra 10 that comes from the carry in the units column.', '2026-11-07 06:42:26'),
(4, 2, 9, 2, '600', '600', 1, 'Add 420 and 180 the same way. Units: 0 + 0 = 0. Tens: 2 + 8 = 10, write 0 and carry 1. Hundreds: 4 + 1 = 5, plus the carried 1 makes 6. The sum is 600, which matches the correct answer.', '2026-11-07 06:42:26');

-- --------------------------------------------------------

--
-- Table structure for table `quiz_attempts`
--

CREATE TABLE `quiz_attempts` (
  `attempt_id` int(11) NOT NULL,
  `student_id` int(11) NOT NULL,
  `quiz_type` enum('default','adaptive') NOT NULL,
  `year_level` tinyint(4) NOT NULL,
  `subject` varchar(50) NOT NULL,
  `topic` varchar(100) NOT NULL,
  `score` decimal(5,2) DEFAULT NULL,
  `total_questions` int(11) NOT NULL,
  `correct_answers` int(11) DEFAULT NULL,
  `performance_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`performance_json`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `quiz_attempts`
--

INSERT INTO `quiz_attempts` (`attempt_id`, `student_id`, `quiz_type`, `year_level`, `subject`, `topic`, `score`, `total_questions`, `correct_answers`, `performance_json`, `created_at`) VALUES
(1, 1, 'default', 4, 'Mathematics', 'Addition', 50.00, 2, 1, '{\"quiz_type\": \"default\", \"score\": 50.0, \"correct\": 1, \"total\": 2, \"weak_skills\": {\"addition\": 1}, \"question_results\": [{\"question_id\": 1, \"question\": \"What is 125 + 235?\", \"student_answer\": \"360\", \"correct_answer\": \"360\", \"is_correct\": true, \"skill\": \"addition\"}, {\"question_id\": 2, \"question\": \"What is 420 + 180?\", \"student_answer\": \"500\", \"correct_answer\": \"600\", \"is_correct\": false, \"skill\": \"addition\"}], \"year\": 4, \"subject\": \"Mathematics\", \"topic\": \"Addition\"}', '2026-11-07 04:19:45'),
(2, 1, 'default', 4, 'Mathematics', 'Addition', 50.00, 2, 1, '{\"quiz_type\": \"default\", \"score\": 50.0, \"correct\": 1, \"total\": 2, \"weak_skills\": {\"addition\": 1}, \"question_results\": [{\"question_id\": 1, \"question\": \"What is 125 + 235?\", \"student_answer\": \"360\", \"correct_answer\": \"360\", \"is_correct\": true, \"skill\": \"addition\"}, {\"question_id\": 2, \"question\": \"What is 420 + 180?\", \"student_answer\": \"500\", \"correct_answer\": \"600\", \"is_correct\": false, \"skill\": \"addition\"}], \"year\": 4, \"subject\": \"Mathematics\", \"topic\": \"Addition\"}', '2026-11-07 04:29:05'),
(3, 1, 'adaptive', 4, 'Mathematics', 'Addition', 100.00, 3, 3, '{\"quiz_type\": \"adaptive\", \"default_attempt_id\": 2, \"score\": 100.0, \"correct\": 3, \"total\": 3, \"default_score\": 50.0, \"improvement\": 50.0, \"question_results\": [{\"question_id\": 1, \"student_answer\": \"620\", \"is_correct\": true, \"skill\": \"addition\"}, {\"question_id\": 2, \"student_answer\": \"700\", \"is_correct\": true, \"skill\": \"addition\"}, {\"question_id\": 3, \"student_answer\": \"797\", \"is_correct\": true, \"skill\": \"addition\"}]}', '2026-11-07 04:35:57'),
(4, 1, 'default', 4, 'Mathematics', 'Addition', 50.00, 2, 1, '{\"quiz_type\": \"default\", \"score\": 50.0, \"correct\": 1, \"total\": 2, \"weak_skills\": {\"addition\": 1}, \"question_results\": [{\"question_id\": 1, \"question\": \"What is 125 + 235?\", \"student_answer\": \"360\", \"correct_answer\": \"360\", \"is_correct\": true, \"skill\": \"addition\"}, {\"question_id\": 2, \"question\": \"What is 420 + 180?\", \"student_answer\": \"500\", \"correct_answer\": \"600\", \"is_correct\": false, \"skill\": \"addition\"}], \"year\": 4, \"subject\": \"Mathematics\", \"topic\": \"Addition\"}', '2026-11-07 05:04:58'),
(5, 1, 'adaptive', 4, 'Mathematics', 'Addition', 100.00, 3, 3, '{\"quiz_type\": \"adaptive\", \"default_attempt_id\": 4, \"score\": 100.0, \"correct\": 3, \"total\": 3, \"default_score\": 50.0, \"improvement\": 50.0, \"question_results\": [{\"question_id\": 4, \"student_answer\": \"620\", \"is_correct\": true, \"skill\": \"addition\"}, {\"question_id\": 5, \"student_answer\": \"434\", \"is_correct\": true, \"skill\": \"addition\"}, {\"question_id\": 6, \"student_answer\": \"775\", \"is_correct\": true, \"skill\": \"addition\"}]}', '2026-11-07 05:06:54'),
(6, 2, 'default', 4, 'Mathematics', 'Addition', 50.00, 2, 1, '{\"quiz_type\": \"default\", \"score\": 50.0, \"correct\": 1, \"total\": 2, \"weak_skills\": {\"addition\": 1}, \"question_results\": [{\"question_id\": 1, \"question\": \"What is 125 + 235?\", \"student_answer\": \"360\", \"correct_answer\": \"360\", \"is_correct\": true, \"skill\": \"addition\"}, {\"question_id\": 2, \"question\": \"What is 420 + 180?\", \"student_answer\": \"500\", \"correct_answer\": \"600\", \"is_correct\": false, \"skill\": \"addition\"}], \"year\": 4, \"subject\": \"Mathematics\", \"topic\": \"Addition\"}', '2026-11-07 05:38:57'),
(7, 2, 'adaptive', 4, 'Mathematics', 'Addition', 100.00, 3, 3, '{\"quiz_type\": \"adaptive\", \"default_attempt_id\": 6, \"score\": 100.0, \"correct\": 3, \"total\": 3, \"default_score\": 50.0, \"improvement\": 50.0, \"question_results\": [{\"question_id\": 7, \"student_answer\": \"620\", \"is_correct\": true, \"skill\": \"addition\"}, {\"question_id\": 8, \"student_answer\": \"623\", \"is_correct\": true, \"skill\": \"addition\"}, {\"question_id\": 9, \"student_answer\": \"1053\", \"is_correct\": true, \"skill\": \"addition\"}]}', '2026-11-07 05:40:04'),
(8, 2, 'default', 4, 'Mathematics', 'Addition', 50.00, 2, 1, '{\"quiz_type\": \"default\", \"score\": 50.0, \"correct\": 1, \"total\": 2, \"weak_skills\": {\"addition\": 1}, \"question_results\": [{\"question_id\": 1, \"question\": \"What is 125 + 235?\", \"student_answer\": \"350\", \"correct_answer\": \"360\", \"is_correct\": false, \"skill\": \"addition\"}, {\"question_id\": 2, \"question\": \"What is 420 + 180?\", \"student_answer\": \"600\", \"correct_answer\": \"600\", \"is_correct\": true, \"skill\": \"addition\"}], \"year\": 4, \"subject\": \"Mathematics\", \"topic\": \"Addition\"}', '2026-11-07 06:35:35'),
(9, 2, 'default', 4, 'Mathematics', 'Addition', 50.00, 2, 1, '{\"quiz_type\": \"default\", \"score\": 50.0, \"correct\": 1, \"total\": 2, \"weak_skills\": {\"addition\": 1}, \"question_results\": [{\"question_id\": 1, \"question\": \"What is 125 + 235?\", \"student_answer\": \"350\", \"correct_answer\": \"360\", \"is_correct\": false, \"skill\": \"addition\"}, {\"question_id\": 2, \"question\": \"What is 420 + 180?\", \"student_answer\": \"600\", \"correct_answer\": \"600\", \"is_correct\": true, \"skill\": \"addition\"}], \"year\": 4, \"subject\": \"Mathematics\", \"topic\": \"Addition\"}', '2026-11-07 06:42:23');

-- --------------------------------------------------------

--
-- Table structure for table `shop_items`
--

CREATE TABLE `shop_items` (
  `item_id` int(11) NOT NULL,
  `item_name` varchar(100) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `category` varchar(50) NOT NULL,
  `price` int(11) NOT NULL,
  `image_path` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1
) ;

--
-- Dumping data for table `shop_items`
--

INSERT INTO `shop_items` (`item_id`, `item_name`, `description`, `category`, `price`, `image_path`, `is_active`) VALUES
(1, 'Pink Coral', 'A beautiful pink coral for your ocean home.', 'Coral', 75, '/static/images/shop/pink_coral.png', 1),
(2, 'Pearl Oyster', 'An oyster holding a bright, precious pearl.', 'Shell', 130, NULL, 1),
(3, 'Treasure Chest', 'A mysterious underwater treasure chest.', 'Treasure', 175, '/static/images/shop/treasure_chest.png', 1),
(4, 'Sand Castle', 'A lovely sand castle under the sea.', 'Building', 200, '/static/images/shop/sand_castle.png', 1),
(5, 'Seaweed Garden', 'A relaxing garden of green seaweed.', 'Plant', 50, '/static/images/shop/seaweed.png', 1),
(6, 'Starfish', 'A colourful starfish decoration.', 'Decoration', 30, '/static/images/shop/starfish.png', 1),
(7, 'Giant Clam', 'A cosy giant clam where little fish can hide.', 'Shell', 90, NULL, 1),
(8, 'Shipwreck', 'An old sunken ship full of ocean secrets.', 'Building', 250, NULL, 1),
(9, 'Bubble Lamp', 'A glowing lamp to brighten your underwater home.', 'Decoration', 110, NULL, 1),
(10, 'Coral Rock', 'A smooth ocean rock for fish to rest beside.', 'Decoration', 40, NULL, 1),
(11, 'Sea Flower', 'A colourful flower that blooms beneath the waves.', 'Plant', 60, NULL, 1),
(12, 'Golden Crown', 'A treasure fit for the king or queen of the ocean.', 'Treasure', 320, NULL, 1),
(13, 'Moon Jelly', 'A glowing moon jelly drifting through the blue.', 'Sea Life', 150, NULL, 1),
(14, 'Dolphin Statue', 'A cheerful dolphin statue for your ocean home.', 'Decoration', 220, NULL, 1),
(15, 'Coral Arch', 'A grand archway shaped from colourful coral.', 'Building', 280, NULL, 1);

-- --------------------------------------------------------

--
-- Table structure for table `students`
--

CREATE TABLE `students` (
  `student_id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `year_level` tinyint(4) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `password_hash` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `students`
--

INSERT INTO `students` (`student_id`, `username`, `year_level`, `created_at`, `password_hash`) VALUES
(1, 'demo_student', 4, '2026-11-07 04:08:47', NULL),
(2, 'OceanStar24', 4, '2026-11-07 05:18:03', 'scrypt:32768:8:1$Tqx3ZfgSVvQrJ0BQ$25997f4f8d542a5cdb18693eff4ce07ef22f8f9f0e7002bb301dca43680145dcad6186bbbd52880d7097b12518ab03d8d0d54aae4feb1b6b932d3a19b6d37937'),
(4, 'misa', 5, '2026-11-08 02:41:29', 'scrypt:32768:8:1$FF3aRWkm70QkuXWY$111acdafced00c85777b0a22f1b3667adb33d08809c54685c04cdd41cdcf675404a760c6292aaf9d54b067cbce2203f6ab6dfaa7bb85fd9b45636d4129c1bbcf'),
(5, 'Safia', 5, '2026-11-08 02:43:42', 'scrypt:32768:8:1$RCdlKoyPFEhrDTpb$e1115b1febcac9e41a410a4eb6d6b14f3c35caee2dc4aca2168871fce381d7fa6a8eb6bd4f73506ccdf31bc8bd94130b199e9bab9cb6a30c7e0c73b6f3eacef9');

-- --------------------------------------------------------

--
-- Table structure for table `student_inventory`
--

CREATE TABLE `student_inventory` (
  `inventory_id` int(11) NOT NULL,
  `student_id` int(11) NOT NULL,
  `item_id` int(11) NOT NULL,
  `is_placed` tinyint(1) NOT NULL DEFAULT 0,
  `position_x` decimal(6,3) DEFAULT NULL,
  `position_y` decimal(6,3) DEFAULT NULL,
  `purchased_at` timestamp NOT NULL DEFAULT current_timestamp()
) ;

--
-- Dumping data for table `student_inventory`
--

INSERT INTO `student_inventory` (`inventory_id`, `student_id`, `item_id`, `is_placed`, `position_x`, `position_y`, `purchased_at`) VALUES
(1, 2, 1, 1, 0.450, 0.700, '2026-11-07 05:56:02');

-- --------------------------------------------------------

--
-- Table structure for table `student_rewards`
--

CREATE TABLE `student_rewards` (
  `reward_id` int(11) NOT NULL,
  `student_id` int(11) NOT NULL,
  `attempt_id` int(11) NOT NULL,
  `fish_type` varchar(50) NOT NULL,
  `pearls_earned` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `student_rewards`
--

INSERT INTO `student_rewards` (`reward_id`, `student_id`, `attempt_id`, `fish_type`, `pearls_earned`, `created_at`) VALUES
(1, 1, 3, 'Royal Betta', 30, '2026-11-07 04:40:25'),
(2, 1, 5, 'Royal Betta', 30, '2026-11-07 05:06:54'),
(3, 2, 7, 'Royal Betta', 30, '2026-11-07 05:40:04');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `adaptive_questions`
--
ALTER TABLE `adaptive_questions`
  ADD PRIMARY KEY (`adaptive_id`),
  ADD KEY `attempt_id` (`attempt_id`);

--
-- Indexes for table `learning_notes`
--
ALTER TABLE `learning_notes`
  ADD PRIMARY KEY (`note_id`),
  ADD UNIQUE KEY `uq_learning_note_attempt` (`attempt_id`),
  ADD KEY `student_id` (`student_id`);

--
-- Indexes for table `pearl_transactions`
--
ALTER TABLE `pearl_transactions`
  ADD PRIMARY KEY (`transaction_id`),
  ADD UNIQUE KEY `uq_inventory_purchase` (`inventory_id`),
  ADD KEY `student_id` (`student_id`);

--
-- Indexes for table `questions`
--
ALTER TABLE `questions`
  ADD PRIMARY KEY (`question_id`);

--
-- Indexes for table `question_explanations`
--
ALTER TABLE `question_explanations`
  ADD PRIMARY KEY (`explanation_id`),
  ADD UNIQUE KEY `uq_attempt_question` (`attempt_id`,`question_id`),
  ADD KEY `student_id` (`student_id`),
  ADD KEY `question_id` (`question_id`);

--
-- Indexes for table `quiz_attempts`
--
ALTER TABLE `quiz_attempts`
  ADD PRIMARY KEY (`attempt_id`),
  ADD KEY `student_id` (`student_id`);

--
-- Indexes for table `shop_items`
--
ALTER TABLE `shop_items`
  ADD PRIMARY KEY (`item_id`);

--
-- Indexes for table `students`
--
ALTER TABLE `students`
  ADD PRIMARY KEY (`student_id`),
  ADD UNIQUE KEY `username` (`username`);

--
-- Indexes for table `student_inventory`
--
ALTER TABLE `student_inventory`
  ADD PRIMARY KEY (`inventory_id`),
  ADD KEY `student_id` (`student_id`),
  ADD KEY `item_id` (`item_id`);

--
-- Indexes for table `student_rewards`
--
ALTER TABLE `student_rewards`
  ADD PRIMARY KEY (`reward_id`),
  ADD UNIQUE KEY `unique_attempt_reward` (`attempt_id`),
  ADD KEY `student_id` (`student_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `adaptive_questions`
--
ALTER TABLE `adaptive_questions`
  MODIFY `adaptive_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT for table `learning_notes`
--
ALTER TABLE `learning_notes`
  MODIFY `note_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `pearl_transactions`
--
ALTER TABLE `pearl_transactions`
  MODIFY `transaction_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `questions`
--
ALTER TABLE `questions`
  MODIFY `question_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `question_explanations`
--
ALTER TABLE `question_explanations`
  MODIFY `explanation_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `quiz_attempts`
--
ALTER TABLE `quiz_attempts`
  MODIFY `attempt_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `shop_items`
--
ALTER TABLE `shop_items`
  MODIFY `item_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `students`
--
ALTER TABLE `students`
  MODIFY `student_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `student_inventory`
--
ALTER TABLE `student_inventory`
  MODIFY `inventory_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `student_rewards`
--
ALTER TABLE `student_rewards`
  MODIFY `reward_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `adaptive_questions`
--
ALTER TABLE `adaptive_questions`
  ADD CONSTRAINT `adaptive_questions_ibfk_1` FOREIGN KEY (`attempt_id`) REFERENCES `quiz_attempts` (`attempt_id`);

--
-- Constraints for table `learning_notes`
--
ALTER TABLE `learning_notes`
  ADD CONSTRAINT `learning_notes_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`),
  ADD CONSTRAINT `learning_notes_ibfk_2` FOREIGN KEY (`attempt_id`) REFERENCES `quiz_attempts` (`attempt_id`);

--
-- Constraints for table `pearl_transactions`
--
ALTER TABLE `pearl_transactions`
  ADD CONSTRAINT `pearl_transactions_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`),
  ADD CONSTRAINT `pearl_transactions_ibfk_2` FOREIGN KEY (`inventory_id`) REFERENCES `student_inventory` (`inventory_id`);

--
-- Constraints for table `question_explanations`
--
ALTER TABLE `question_explanations`
  ADD CONSTRAINT `question_explanations_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`),
  ADD CONSTRAINT `question_explanations_ibfk_2` FOREIGN KEY (`attempt_id`) REFERENCES `quiz_attempts` (`attempt_id`),
  ADD CONSTRAINT `question_explanations_ibfk_3` FOREIGN KEY (`question_id`) REFERENCES `questions` (`question_id`);

--
-- Constraints for table `quiz_attempts`
--
ALTER TABLE `quiz_attempts`
  ADD CONSTRAINT `quiz_attempts_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`);

--
-- Constraints for table `student_inventory`
--
ALTER TABLE `student_inventory`
  ADD CONSTRAINT `student_inventory_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`),
  ADD CONSTRAINT `student_inventory_ibfk_2` FOREIGN KEY (`item_id`) REFERENCES `shop_items` (`item_id`);

--
-- Constraints for table `student_rewards`
--
ALTER TABLE `student_rewards`
  ADD CONSTRAINT `student_rewards_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`),
  ADD CONSTRAINT `student_rewards_ibfk_2` FOREIGN KEY (`attempt_id`) REFERENCES `quiz_attempts` (`attempt_id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
