# Aphrodite Senior Project 2 Report

## Updated Contents Lists

Page numbers below correspond to the 69-page Google Docs PDF export reviewed on 9 October 2026. Replacing the existing preliminary lists with these longer lists may move later content to new pages; refresh the page numbers after the final layout is complete.

The current report repeats Figure 1, Figure 2, and Table 2. The lists below correct those duplicates by using continuous numbering. The matching captions and cross-references in the report body must be renumbered to agree with these lists.

## Table of Contents

Abstract ........................................................................................................ 3

Table of Contents ........................................................................................ 4

List of Figures ............................................................................................. 6

List of Tables .............................................................................................. 7

Chapter 1: Introduction ............................................................................... 8

1.1 Background ........................................................................................... 8

1.2 Problem Statement ............................................................................... 8

1.3 Project Objectives ................................................................................ 8

1.4 Evidence and Method ........................................................................... 8

1.5 Project Client ........................................................................................ 9

1.5.1 Client Overview .................................................................................. 9

1.5.2 Client Needs ....................................................................................... 9

1.5.3 Benefits to the Client ....................................................................... 10

1.5.4 Client Photograph and Location ...................................................... 11

Chapter 2: Stakeholders and Requirements ............................................. 12

2.1 Stakeholder Groups ............................................................................ 12

2.2 Functional Requirements ................................................................... 12

2.3 Non-Functional Requirements ............................................................ 13

2.4 Use-Case Model .................................................................................. 14

Chapter 3: Scope, Assumptions, and Limitations ...................................... 15

3.1 In Scope ............................................................................................... 15

3.2 Out of Scope or Externally Dependent ............................................... 15

3.3 Current Limitations .............................................................................. 16

Chapter 4: Feasibility and Cost-Benefit Analysis ....................................... 16

4.1 Technical Feasibility ............................................................................ 16

4.2 Operational Feasibility ........................................................................ 16

4.3 Cost Considerations ............................................................................ 16

4.4 Expected Benefits ............................................................................... 17

Chapter 5: System Analysis and Architecture ........................................... 17

5.1 System Context .................................................................................... 17

5.2 Data-Flow Analysis .............................................................................. 18

5.3 Architectural Overview ........................................................................ 19

5.4 Repository Structure ........................................................................... 20

5.5 Technology Stack ................................................................................ 21

Chapter 6: Logical Design and Data Model ................................................ 22

6.1 Database Logical Design ..................................................................... 22

6.2 Transactional Checkout ...................................................................... 22

6.3 Order Lifecycle ..................................................................................... 23

6.4 Core Domain Model ............................................................................. 24

6.5 Transactional Checkout ...................................................................... 25

6.6 Order Lifecycle ..................................................................................... 25

Chapter 7: Interface and Experience Design ............................................ 25

7.1 Design Language ................................................................................. 25

7.2 Guided Selection ................................................................................. 26

7.3 Administrative Separation .................................................................. 27

7.4 Privacy-Aware Location Flow .............................................................. 27

7.5 Accessibility and Responsive Design ................................................. 28

Chapter 8: User-Side Interface and System Walkthrough ........................ 28

8.1 Customer Navigation Flow .................................................................. 28

8.2 Customer Purchase Process ............................................................... 29

8.3 Product Return and Refund Process ................................................... 30

8.4 Home Page ........................................................................................... 31

8.5 Language Selection ............................................................................ 32

8.6 Product Search and Category Navigation ......................................... 33

8.7 Product Filtering and Sorting .............................................................. 34

8.8 Product Details .................................................................................... 35

8.9 Laptop Recommendation Tool ............................................................ 36

8.10 Product Comparison ......................................................................... 37

8.11 PC Build Planner ............................................................................... 38

8.12 Customer Registration ...................................................................... 39

8.13 Customer Login ................................................................................. 40

8.14 Shopping Cart .................................................................................... 41

8.15 Checkout ............................................................................................ 42

8.16 Order History ...................................................................................... 43

Chapter 9: Admin and Staff Panel .............................................................. 43

9.1 Admin Panel Overview ......................................................................... 43

9.2 Administrative Actors and Use Cases ................................................ 44

9.3 Roles and Permissions ........................................................................ 44

9.4 Admin Authentication and Authorization ............................................ 45

9.5 Admin Navigation Flow ......................................................................... 46

9.6 Product and Inventory Management ................................................... 47

9.7 Pricing and Wholesale Management ................................................... 48

9.8 Order, Payment, and Delivery Management ........................................ 49

9.9 Return and Refund Management ......................................................... 49

9.10 Work Queue and Staff Notes ............................................................. 50

9.11 Customer Support Management ........................................................ 51

9.12 Advertisements and Customer Locations .......................................... 51

9.12.1 Homepage Advertisement Management ........................................ 51

9.12.2 Customer Location Management ................................................... 52

9.13 Reports and Audit Records ................................................................ 53

9.14 Admin Panel Interface ........................................................................ 53

9.14.1 Admin and Staff Login ..................................................................... 54

9.14.2 Administrative Dashboard .............................................................. 54

9.14.3 Business Statistics Overview ......................................................... 55

9.14.4 Administrative Work Queue ............................................................ 56

9.14.5 Product and Inventory Management ............................................... 57

9.14.6 Product Create or Edit Form ........................................................... 58

9.14.7 Product Spreadsheet Synchronization ........................................... 59

9.14.8 Administrative Order Queue ........................................................... 60

9.14.9 Wholesale Account Management ................................................... 60

9.14.10 Customer-Support Conversation Queue ....................................... 61

9.14.11 Staff Account Management .......................................................... 62

Chapter 10: Implementation ....................................................................... 62

10.1 Catalogue and Discovery ................................................................... 62

10.2 Authentication and Authorization ..................................................... 62

10.3 Commerce Workflows ......................................................................... 62

10.4 Support and Assistant ........................................................................ 63

10.5 Internationalization ............................................................................ 63

10.6 Deployment Implementation ............................................................. 63

Chapter 11: Security and Privacy Analysis ................................................ 63

11.1 Security Boundary .............................................................................. 63

11.2 Database Security .............................................................................. 64

11.3 Privacy Considerations ....................................................................... 64

Chapter 12: Testing and Verification .......................................................... 64

12.1 Executed Checks ................................................................................ 64

12.2 Test Coverage by Behavior ................................................................ 65

12.3 Observed Warnings and Test Gaps ................................................... 65

Chapter 13: Deployment and Operations ................................................... 65

13.1 Deployment Topology ........................................................................ 65

13.2 Release Procedure ............................................................................ 66

13.3 Operational Monitoring ...................................................................... 66

13.4 Backup and Recovery ........................................................................ 66

Chapter 14: Risk Assessment and Improvement Plan ............................... 67

14.1 Prioritized Improvements ................................................................... 67

Chapter 15: Conclusion ............................................................................... 68

Chapter 16: References .............................................................................. 68

## List of Figures

Figure 1. Official Aphrodite Myanmar brand identity ................................ 11

Figure 2. Aphrodite Myanmar business location ....................................... 11

Figure 3. Use-case diagram showing the principal actors and functions of Aphrodite Shop ...................................................................................... 15

Figure 4. System context diagram showing Aphrodite Shop and its external actors and services .................................................................................... 18

Figure 5. Level-0 data-flow diagram for Aphrodite Shop .......................... 19

Figure 6. Layered client-server architecture of Aphrodite Shop ............... 20

Figure 7. Repository artifact counts identified by static analysis ............. 21

Figure 8. Crow's-foot entity-relationship diagram showing the principal Aphrodite Shop entities and cardinalities .................................................. 22

Figure 9. Sequence diagram for Aphrodite Shop's transactional checkout process ........................................................................................................ 23

Figure 10. State diagram showing the Aphrodite Shop order lifecycle ...... 23

Figure 11. Core data-model families; simplified for readability ............... 24

Figure 12. Simplified checkout transaction sequence ................................ 25

Figure 13. Aphrodite storefront home interface captured from the production build .......................................................................................... 26

Figure 14. PC Build Planner landing interface ............................................ 26

Figure 15. Admin and staff sign-in interface ............................................... 27

Figure 16. Delivery-location consent interface ........................................... 28

Figure 17. Activity diagram showing the customer-navigation flow through Aphrodite Shop ............................................................................................ 29

Figure 18. Swimlane diagram showing responsibilities during the Aphrodite Shop purchasing process ............................................................................ 30

Figure 19. Swimlane diagram showing the Aphrodite Shop return and refund process .............................................................................................. 30

Figure 20. Aphrodite Shop customer home page ....................................... 31

Figure 21. English and Burmese language-selection controls .................. 32

Figure 22. Product-search function on the storefront ................................ 33

Figure 23. Product filtering and sorting interface ...................................... 34

Figure 24. Product details page .................................................................. 35

Figure 25. Find My Laptop recommendation tool ....................................... 36

Figure 26. Side-by-side product comparison .............................................. 37

Figure 27. PC Build Planner home page ..................................................... 38

Figure 28. Customer-registration page ...................................................... 39

Figure 29. Customer login interface ........................................................... 40

Figure 30. Adding a product to the shopping cart ...................................... 41

Figure 31. Customer checkout page ........................................................... 42

Figure 32. Customer order-history page .................................................... 43

Figure 33. Administrative use-case diagram for Aphrodite Shop .............. 44

Figure 34. Role-based access-control model for administrators and staff members ....................................................................................................... 45

Figure 35. Sequence diagram for administrative authentication and authorization ................................................................................................ 46

Figure 36. Activity diagram showing navigation through the Aphrodite admin panel .................................................................................................. 47

Figure 37. Swimlane diagram for administrative product and inventory management ................................................................................................. 47

Figure 38. Administrative workflow for pricing and wholesale-account management ................................................................................................. 48

Figure 39. Swimlane diagram for administrative order, payment, and delivery processing ..................................................................................... 49

Figure 40. Administrative activity diagram for processing product returns and refunds .................................................................................................. 50

Figure 41. Administrative work-queue and task-assignment process ........ 50

Figure 42. Sequence diagram for administrative customer-support management ................................................................................................. 51

Figure 43. Create advertisement form ........................................................ 52

Figure 44. Customer-location list ................................................................ 52

Figure 45. Administrative reporting and audit-information flow ................. 53

Figure 46. Aphrodite administrator and staff login interface ..................... 54

Figure 47. Main Aphrodite administrative dashboard ................................. 54

Figure 48. Administrative business-statistics overview .............................. 55

Figure 49. Administrative work-queue interface ......................................... 56

Figure 50. Product and inventory-management interface .......................... 57

Figure 51. Administrative product create and edit form: (a) basic information and (b) pricing and specifications ............................................. 58

Figure 52. Product synchronization preview and result summary .............. 59

Figure 53. Administrative order-processing queue ..................................... 60

Figure 54. Administrative wholesale-account management interface ........ 60

Figure 55. Administrative customer-support conversation queue .............. 61

Figure 56. Administrative staff-account list ................................................ 62

Figure 57. Deployment diagram showing the main Aphrodite Shop production components and external services ............................................ 66

## List of Tables

Table 1. Repository evidence summary ....................................................... 9

Table 2. Principal needs of the Aphrodite business client and the corresponding system response .................................................................. 10

Table 3. Stakeholder groups ........................................................................ 12

Table 4. Functional requirements traced to implementation evidence ...... 13

Table 5. Non-functional requirements ......................................................... 14

Table 6. Technology stack ........................................................................... 22

Table 7. Core data entities .......................................................................... 25

Table 8. Security-control assessment ......................................................... 64

Table 9. Verification results on 28 September 2026 ................................... 65

Table 10. Risk register ................................................................................ 67

Table 11. Future-development roadmap ..................................................... 68

## Required Corrections Before Submission

1. Renumber the body captions continuously so they match the corrected lists above.
2. Change the current Chapter 2 use-case caption from Figure 1 to Figure 3, then increase every later figure number by two through Figure 57.
3. Keep the Chapter 1 client-needs table as Table 2; change the stakeholder table to Table 3, then increase every later table number by one through Table 11.
4. Remove figure and table captions from the Google Docs document outline by applying a dedicated Caption style or Normal Text instead of Heading 3.
5. Keep Chapters as Heading 1, numbered sections as Heading 2, and numbered subsections such as 9.14.1 as Heading 3.
6. Insert or refresh the automatic Table of Contents only after all captions, images, and page breaks are final.
7. Recheck all page numbers after the longer List of Figures and List of Tables are inserted, because later pages may shift.
